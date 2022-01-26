import * as vscode from 'vscode';
import { DOMParser } from 'xmldom';

const _selector = require('xpath').useNamespaces({ "ns": "http://schemas.microsoft.com/online/cpim/schemas/2013/06" });

export default class RenumberStepsSinglePolicy {

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
                // Renumber UserJourneys
                let UserJourneys: number = RenumberStepsSinglePolicy.renumberOrchestrationSteps(xmlDoc, editBuilder, "/ns:TrustFrameworkPolicy/ns:UserJourneys/ns:UserJourney");

                // Renumber SubJourneys
                let SubJourneys: number = RenumberStepsSinglePolicy.renumberOrchestrationSteps(xmlDoc, editBuilder, "/ns:TrustFrameworkPolicy/ns:SubJourneys/ns:SubJourney");

                if (UserJourneys === 0 && SubJourneys === 0) {
                    vscode.window.showInformationMessage("No user journeys or sub journeys found in this policy.");
                }
                else {
                    vscode.window.showInformationMessage("Successfully renumbered " + UserJourneys + " user journeys, and " + SubJourneys + " sub journeys.");
                }

            });

        } catch (e: any) {
            vscode.window.showErrorMessage(e.message);
        }
    }

    // Renumber documents' user journeys, or sub journeys
    private static renumberOrchestrationSteps(xmlDoc, editBuilder, parentElement): number {
        let journeys = _selector(parentElement, xmlDoc);

        if (journeys.length === 0) {
            // No journeys or sub journeys found
            return 0;
        }

        let numberOfJourneysRenumbered = 0;

        for (let journey of journeys) {
            let steps = _selector("./ns:OrchestrationSteps/ns:OrchestrationStep", journey);
            if (steps.length === 0) {
                // No steps to renumber
                continue;
            }

            numberOfJourneysRenumbered += 1;

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

        return numberOfJourneysRenumbered;
    }
}
