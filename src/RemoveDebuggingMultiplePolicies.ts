import * as vscode from 'vscode';
import { DOMParser } from 'xmldom';
import { PolicyFile } from './PolicyBuild';

export default class DebuggingAttributes {
    static Remove(files: PolicyFile[]): any {
        let policies: Policy[] = [];
        for (let file of files) {
            let policy = null;
            try {
                policy = new Policy(file);
            } catch (e) {
                vscode.window.showErrorMessage(`${file.FileName} has invalid XML. Skipping remove debugging attributes`);
                continue;
            }
            policies.push(policy);
        }

        for (let policy of policies) {
            policy.removeDebuggingElements();
            policy.save();
            vscode.window.showInformationMessage(`Removed debugging attributes from ${policy.file.FileName}`);
        }
    }
}

class Policy {
    public file: PolicyFile
    private root: Element = null
    private isChanged: boolean = false

    constructor(file: PolicyFile) {
        this.file = file;
        const document = new DOMParser().parseFromString(file.Data, "application/xml");
        const root = document.getElementsByTagName("TrustFrameworkPolicy").item(0);
        if (root === null) {
            throw new Error(`File ${this.file.FileName} is missing the 'TrustFrameworkPolicy' element.`);
        } else {
            this.root = root;
        }
    }

    public save() {
        if (this.root === null) {
            return;
        }
        if (this.isChanged) {
            const s = new XMLSerializer();
            this.file.Data = s.serializeToString(this.root.ownerDocument);
        }
    }

    public removeDebuggingElements() {
        if (this.root === null) {
            return;
        }
        if (this.root.hasAttribute("DeploymentMode")) {
            this.root.removeAttribute("DeploymentMode");
            this.isChanged = true;
        }
        if (this.root.hasAttribute("UserJourneyRecorderEndpoint")) {
            this.root.removeAttribute("UserJourneyRecorderEndpoint");
            this.isChanged = true;
        }

        const insightsElements = this.getJourneyInsightsElements();
        for (let i= 0; i < insightsElements.length; i++) {
            this.root.ownerDocument.removeChild(insightsElements[i]);
            this.isChanged = true;
        }
    }

    private getElementsByTagName(name: string): Element[] {
        const elements: Element[] = [];
        const elementCollection = this.root.getElementsByTagName(name);
        for (let i= 0; i < elementCollection.length; i++) {
            elements.push(elementCollection[i]);
        }

        return elements;
    }

    private getJourneyInsightsElements(): Element[] {
        let elements: Element[] = [];

        const elementNames = "RelyingParty/UserJourneyBehaviors/JourneyInsights".split("/");
        for (let i = 0; i < elementNames.length; i++) {
            let name = elementNames.shift();
            if (name !== undefined) {
                elements = this.getElementsByTagName(name);
            }
        }

        return elements
    }
}
