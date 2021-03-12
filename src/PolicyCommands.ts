import * as vscode from 'vscode';

const xpath = require('xpath');
const selector = xpath.useNamespaces({ "ns": "http://schemas.microsoft.com/online/cpim/schemas/2013/06" });

export default class PolicyCommands {
    static renumberPolicy(): any {
        try {
            var editor: vscode.TextEditor = vscode.window.activeTextEditor as vscode.TextEditor;

            if (!editor) {
                vscode.window.showErrorMessage("No document is open");
                return;
            }

            var DOMParser = require('xmldom').DOMParser;
            var xmlDoc = new DOMParser().parseFromString(editor.document.getText(), "application/xml");

            let journeys = selector("/ns:TrustFrameworkPolicy/ns:UserJourneys/ns:UserJourney", xmlDoc);
            if (journeys.length === 0) {
                vscode.window.showInformationMessage("No journeys to renumber");
            }

            for (let journey of journeys) {
                let steps = selector("./ns:OrchestrationSteps/ns:OrchestrationStep", journey);
                if (steps.length === 0) {
                    vscode.window.showInformationMessage("No steps to renumber");
                    continue;
                }
                editor.edit((editBuilder) => {
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
                });
            }
            vscode.window.showInformationMessage("Steps renumbered successfully");
        } catch (e) {
            vscode.window.showErrorMessage(e.message);
            console.log(e.message);
        }
    }

}