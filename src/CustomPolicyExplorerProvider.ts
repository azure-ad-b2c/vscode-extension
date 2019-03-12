import * as vscode from 'vscode';

export default class CustomPolicyExplorerProvider implements vscode.TreeDataProvider<String> {

	_onDidChangeTreeData: vscode.EventEmitter<String | null> = new vscode.EventEmitter<String | null>();
	readonly onDidChangeTreeData: vscode.Event<String | null> = this._onDidChangeTreeData.event;

	editor: vscode.TextEditor;
	autoRefresh: boolean = true;
	xmlDoc: any;

	constructor(/*private context: vscode.ExtensionContext*/) {

		this.editor = vscode.window.activeTextEditor as vscode.TextEditor;
		vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
		vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
		this.parseTree();
		this.onActiveEditorChanged();
	}

	refresh(elementKey?: String): void {
		this.parseTree();
		if (elementKey) {
			this._onDidChangeTreeData.fire(elementKey);
		} else {
			this._onDidChangeTreeData.fire();
		}
	}


	onActiveEditorChanged(): void {
		if (vscode.window.activeTextEditor) {
			if (vscode.window.activeTextEditor.document.uri.scheme === 'file') {
				const enabled = vscode.window.activeTextEditor.document.languageId === 'xml';
				vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', enabled);
				if (enabled) {
					this.refresh();
				}
			}
		} else {
			vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', false);
		}
	}

	onDocumentChanged(changeEvent: vscode.TextDocumentChangeEvent): void {
		if (this.autoRefresh && changeEvent.document.uri.toString() === this.editor.document.uri.toString()) {
			this.parseTree();
			this._onDidChangeTreeData.fire(null);
		}
	}

	parseTree(): void {
		this.editor = vscode.window.activeTextEditor as vscode.TextEditor;

		if (this.editor && this.editor.document) {
			// Load the ativated XML file and replace the element Id with id
			var DOMParser = require('xmldom').DOMParser;
			var xmlText = this.editor.document.getText().replace(/( )(Id=|Id =|Id  =)/gi, " id=");
			this.xmlDoc = new DOMParser().parseFromString(xmlText);
		}
	}


    /*getParent(parentElementKey?: String): String {
        return '';
    }*/

	getElementByTagName(tagName: string) {
		var nsAttr = this.xmlDoc.getElementsByTagName(tagName);

		if (nsAttr.length == 1)
			return nsAttr[0].lineNumber + "|" + nsAttr[0].columnNumber;
		else
			return "";
	}

	getChildren(parentElementKey?: String): Thenable<String[]> {
		const keys: String[] = [];

		if (!parentElementKey) {
			keys.push("root|UserJourney|User Journeys|" + this.getElementByTagName("UserJourneys"));
			keys.push("root|ClaimsProvider|Claims Providers|" + this.getElementByTagName("ClaimsProviders"));
			keys.push("root|TechnicalProfile|Technical Profiles");
			keys.push("root|ClaimType|Claim Types|" + this.getElementByTagName("ClaimsSchema"));
			keys.push("root|ClaimsTransformation|Claims Transformations|" + this.getElementByTagName("ClaimsTransformations"));
			keys.push("root|ContentDefinition|Content Definitions|" + this.getElementByTagName("ContentDefinitions"));
		}
		else {
			const elementValues: String[] = parentElementKey.split("|");

			if (elementValues[0] == "root") {
				var nsAttr = this.xmlDoc.getElementsByTagName(elementValues[1]);

				var i: number;
				for (i = 0; i < nsAttr.length; i++) {
					let title: string = 'Default';
					let children: string = '';

					// Get the element title
					if (elementValues[1] == "ClaimsProvider") {
						var subNode = nsAttr[i].getElementsByTagName("DisplayName");
						if (subNode != null) {
							title = nsAttr[i].getElementsByTagName("DisplayName")[0].textContent

							// Get the claims provider's technical profiles
							var technicalProfiles = nsAttr[i].getElementsByTagName("TechnicalProfile");

							var x: number;
							for (x = 0; x < technicalProfiles.length; x++) {

								// Add the element to the list
								children += technicalProfiles[x].getAttribute("id") + ";"
							}
						}
					}
					else {
						title = nsAttr[i].getAttribute("id");
					}

					// Add the element to the list
					keys.push(elementValues[1] + "|" + title + "|" + nsAttr[i].lineNumber + "|" + nsAttr[i].columnNumber + "|" + children);
				}
			}
			else if (elementValues[0] == "ClaimsProvider") {

				if (elementValues[4] && elementValues[4] != "") {
					var descendants = elementValues[4].split(";");

					for (let entry of descendants) {
						if (entry && entry != "") {
							// Lookup the XML element
							var nsAttr = this.xmlDoc.getElementById(entry);

							// Add the element to the list
							keys.push(nsAttr.nodeName + "|" + nsAttr.getAttribute("id") + "|" + nsAttr.lineNumber + "|" + nsAttr.columnNumber);
						}
					}

				}
			}

			keys.sort();
		}

		return Promise.resolve(keys);
	}

	getTreeItem(elementKey: String): vscode.TreeItem {

		let treeItem: vscode.TreeItem;
		const elementValues: String[] = elementKey.split("|");

		if (elementValues[0] == "root") {
			// For the root elements, check the amount of such element type
			var nsAttr = this.xmlDoc.getElementsByTagName(elementValues[1]);
			treeItem = new vscode.TreeItem(elementValues[2] as string, nsAttr.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

			// Add a link to the root elements such as ClaimsSchema, ClaimsProviders and UserJourneys
			if (elementValues.length == 5) {
				const start: vscode.Position = new vscode.Position(Number(elementValues[3]) - 1, Number(elementValues[4]));
				const end: vscode.Position = new vscode.Position(Number(elementValues[3]) - 1, Number(elementValues[4]));

				treeItem.command = {
					command: 'extension.openJsonSelection',
					title: '',
					arguments: [new vscode.Range(start, end)]
				};
			}

		}
		else {
			if (elementValues[0] == "ClaimsProvider") {
				// For the ClaimsProvider elements, check if the claim provider has technical profile
				treeItem = new vscode.TreeItem(elementValues[1] as string, elementValues[4].split(";").length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
			}
			else {
				treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.None);
			}

			const start: vscode.Position = new vscode.Position(Number(elementValues[2]) - 1, Number(elementValues[3]));
			const end: vscode.Position = new vscode.Position(Number(elementValues[2]) - 1, Number(elementValues[3]));

			treeItem.command = {
				command: 'extension.openJsonSelection',
				title: '',
				arguments: [new vscode.Range(start, end)]
			};
		}

		return treeItem;
	}

	select(range: vscode.Range) {
		this.editor.selection = new vscode.Selection(range.start, range.end);
		this.editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
	}
}