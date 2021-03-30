import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DOMParser, Document } from 'xmldom';
import { PolicyFile } from './PolicyBuild';

const _selector = require('xpath').useNamespaces({ "ns": "http://schemas.microsoft.com/online/cpim/schemas/2013/06" });

export default class OrchestrationStepsRenumber {

    // Renumber a single policy document (using the editor)
    static RenumberPolicyDocument(): any {
        try {
            var editor: vscode.TextEditor = vscode.window.activeTextEditor as vscode.TextEditor;

            if (!editor) {
                vscode.window.showErrorMessage("No document is open");
                return;
            }

            var xmlDoc = new DOMParser().parseFromString(editor.document.getText(), "application/xml");

            editor.edit((editBuilder) => {
                OrchestrationStepsRenumber.renumberOrchestrationSteps(xmlDoc, editBuilder, "/ns:TrustFrameworkPolicy/ns:UserJourneys/ns:UserJourney");
                OrchestrationStepsRenumber.renumberOrchestrationSteps(xmlDoc, editBuilder, "/ns:TrustFrameworkPolicy/ns:SubJourneys/ns:SubJourney");
            });

        } catch (e) {
            vscode.window.showErrorMessage(e.message);
        }
    }

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
            let base = policy.selector("string(/ns:TrustFrameworkPolicy/ns:BasePolicy/ns:PolicyId)");
            if (base && policies.has(base)) {
                policy.base = policies.get(base);
            }
        }

        for (let policy of policies.values()) {
            policy.process();
        }
    }

    // Renumber documents' user journeys, or sub journeys
    private static renumberOrchestrationSteps(xmlDoc, editBuilder, parentElement): any {
        let journeys = _selector(parentElement, xmlDoc);
        if (journeys.length === 0) {
            vscode.window.showInformationMessage("No journeys to renumber");
        }

        for (let journey of journeys) {
            let steps = _selector("./ns:OrchestrationSteps/ns:OrchestrationStep", journey);
            if (steps.length === 0) {
                vscode.window.showInformationMessage("No steps to renumber");
                continue;
            }

            for (let i = 0; i < steps.length; i++) {
                let orderAttr;
                for (let j = 0; j < steps[i].attributes.length; j++) {
                    if (steps[i].attributes[j].name === "Order") {
                        orderAttr = steps[i].attributes[j];
                        break;
                    }
                }
                if (!orderAttr) {
                    vscode.window.showWarningMessage(`Step ${i} missing order attribute. Will not be renumbered!`);
                    continue;
                }

                let start = new vscode.Position(orderAttr.lineNumber - 1, orderAttr.columnNumber);
                let end = new vscode.Position(orderAttr.lineNumber - 1, orderAttr.columnNumber + orderAttr.nodeValue.length);

                let range = new vscode.Range(start, end);

                editBuilder.replace(range, (i + 1).toString());
            }
        }


        vscode.window.showInformationMessage("Steps renumbered successfully");
    }

}

class Policy {
    xml: Document;
    file: PolicyFile;
    base: Policy | undefined;
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

    process() {
        if (this.processed) {
            return;
        }
        if (this.base && !this.base.processed) {
            this.base.process();
            this.base.journeys.forEach(j => this.journeys.add(j));
        }
        this.processed = true;
        let journeys = this.selector("/ns:TrustFrameworkPolicy/ns:UserJourneys/ns:UserJourney");
        if (journeys.length === 0) {
            return;
        }
        for (let journey of journeys) {
            let journeyId = _selector("string(./@Id)", journey);
            this.journeys.add(journeyId);
            if (this.base && this.base.journeys.has(journeyId)) {
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