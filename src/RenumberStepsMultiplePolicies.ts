import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DOMParser } from 'xmldom';
import { PolicyFile } from './PolicyBuild';

const _selector = require('xpath').useNamespaces({ "ns": "http://schemas.microsoft.com/online/cpim/schemas/2013/06" });

export default class OrchestrationStepsRenumber {

    // Renumber multiple policies (using the file system)
    static RenumberPolicies(files): any {
        let policies: Map<string, Policy> = new Map();
        for (let file of files) {
            let policy = null;
            try {
                policy = new Policy(file);
            } catch (e) {
                vscode.window.showErrorMessage(`${file.FileName} has invalid XML. Skipping renumber for this file`);
                continue;
            }
            if (!policy.policyId) {
                continue;
            }
            policies.set(policy.policyId, policy);
        }

        // Iterate over all the policies to determine if they have a base file
        for (let policy of policies.values()) {
            let basePolicy = policy.selector("string(/ns:TrustFrameworkPolicy/ns:BasePolicy/ns:PolicyId)");
            if (basePolicy && policies.has(basePolicy)) {
                policy.basePolicy = policies.get(basePolicy);
            }
        }

        for (let policy of policies.values()) {
            policy.process();
        }
    }
}

class Policy {
    xml: Document;
    file: PolicyFile;
    basePolicy: Policy | undefined;
    processed: boolean;
    splitFile: string[];
    policyId: string;
    journeys: Set<string>;
    renumbered: number;
    constructor(file) {
        this.file = file;
        this.xml = new DOMParser().parseFromString(file.Data, "application/xml");
        this.policyId = this.selector("string(/ns:TrustFrameworkPolicy/@PolicyId)");
        this.processed = false;
        this.splitFile = file.Data.split("\n");
        this.journeys = new Set();
        this.renumbered = 0;
    }

    selector(s: string): any {
        return _selector(s, this.xml);
    }

    hasPolicyId(policyId): boolean {

        try {
            if (this.journeys.has(policyId)) {
                return true;
            }

            let seenBases = new Set();
            let config = vscode.workspace.getConfiguration("aadb2c");
            let maxDepth = Number(config.get("maxPolicyRenumberDepth", 15));
            let currentDepth = 0;
            let currentBase: Policy = this.basePolicy;

            // Semi-recursively iterates over the base policies to determine if they have the given policyId
            while ((currentBase !== null && currentBase !== undefined) && currentDepth++ < maxDepth) {
                // If the current base has the policy, we can return true
                if (currentBase.journeys.has(policyId)) {
                    return true;
                }

                // Add the current base to the seen bases, and advance to the next one
                seenBases.add(currentBase.policyId);
                currentBase = currentBase.basePolicy;

                if (currentBase === null || currentBase === undefined || seenBases.has(currentBase.policyId)) {
                    // Either there is no base for the previous base, or we've hit a cycle
                    // Hitting a cycle shouldn't technically be possible, but protect against it anyway as there's
                    // nothing that would prevent people from writing an invalid policy
                    return false;
                }
            }
        }
        catch (error: any) {
            vscode.window.showErrorMessage(error.message);
        }
        // In the event we didn't find the policyId in the base policies, return false
        return false;
    }

    process() {
        if (this.processed) {
            return;
        }
        if (this.basePolicy && !this.basePolicy.processed) {
            this.basePolicy.process();
            this.basePolicy.journeys.forEach(j => this.journeys.add(j));
        }
        this.processed = true;
        let journeys = this.selector("/ns:TrustFrameworkPolicy/ns:UserJourneys/ns:UserJourney");
        if (journeys.length === 0) {
            return;
        }
        for (let journey of journeys) {
            let journeyId = _selector("string(./@Id)", journey);
            this.journeys.add(journeyId);
            if (this.basePolicy && this.basePolicy.hasPolicyId(journeyId)) {
                vscode.window.showInformationMessage(`Skipped renumbering ${this.policyId} because it has a base journey in another file`);
                continue; // We won't renumber anything which has the journey defined in its base because
                // it's impossible to know what the programmer intends
            }
            let steps = _selector("./ns:OrchestrationSteps/ns:OrchestrationStep", journey);
            for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
                let orderAttrs = _selector("./@Order", steps[stepIndex]);
                if (orderAttrs.length === 0) {
                    vscode.window.showErrorMessage(`Step ${stepIndex} of ${this.policyId} is missing the 'Order' attribute`);
                    continue;
                }
                let orderAttr = orderAttrs[0];
                if (orderAttr.value !== (stepIndex + 1).toString()) {
                    orderAttr.value = (stepIndex + 1).toString();
                    this.setOrder(orderAttr);
                    this.renumbered++;
                }
            }
        }
        if (this.renumbered > 0) {
            this.save();
            vscode.window.showInformationMessage(`Renumbered ${this.renumbered} steps in ${this.policyId}`);
        }
    }

    setOrder(orderAttr) {
        let line = this.splitFile[orderAttr.lineNumber - 1];
        line = line.substring(0, orderAttr.columnNumber) + orderAttr.value + line.substring(orderAttr.columnNumber + orderAttr.nodeValue.length);
        this.splitFile[orderAttr.lineNumber - 1] = line;
    }

    save() {
        this.file.Data = "";
        for (let s of this.splitFile) {
            this.file.Data += s + "\n";
        }
        this.file.Data = this.file.Data.trimRight();
        if (this.file.SubFolder) {
            fs.writeFile(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, this.file.SubFolder, this.file.FileName),
                this.file.Data, e => vscode.window.showErrorMessage(e.message));
        } else {
            fs.writeFile(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, this.file.FileName),
                this.file.Data, e => vscode.window.showErrorMessage(e.message));
        }
    }
}
