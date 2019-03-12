import * as vscode from 'vscode';

export class ReferenceProvider implements vscode.ReferenceProvider {
    private files: vscode.Uri[] = [];

    public provideReferences(
        document: vscode.TextDocument, position: vscode.Position,
        options: { includeDeclaration: boolean }, token: vscode.CancellationToken):
        Thenable<vscode.Location[] | null> {

        // Run this code only if user open a directory workspace
        if (vscode.workspace.rootPath) {
            var promise = vscode.workspace.findFiles(new vscode.RelativePattern(vscode.workspace.rootPath as string, '*.{xml}')).then((res) => {
                this.files = res;
                return this.processSearch(document, position);
            });

            return promise;
        }

        return this.processSearch(document, position);

    }

    public static isTagSelected(document: vscode.TextDocument, position: vscode.Position): boolean {

        var range = document.getWordRangeAtPosition(position);

        if (!range)
            return false;

        var word = document.getText(range);
        var index = document.lineAt(position.line).text.indexOf("<" + word);
        return ( index >= 0)
        
    }

    public static getSelectedWord(document: vscode.TextDocument, position: vscode.Position): string {

        // Get the selected word
        const wordPosition = document.getWordRangeAtPosition(position);
        if (!wordPosition) return "";


        // Temporary workaround for separated word with dash (-) or dot (.)
        const line = document.lineAt(position.line).text;
        var startWord: number = wordPosition.start.character;
        var endWord: number = wordPosition.end.character;
        var word2: string = "";

        // Go back toward the start of the line
        for (var i = wordPosition.start.character; i > 0; i--) {
            if (line[i] == "<" || line[i] == ">" || line[i] == " " || line[i] == "'" || line[i] == '"' || line[i] == '\r\n') {
                startWord = i;
                break;
            }
        }

        // Go back toward the end of the line
        for (var i = wordPosition.end.character; i < line.length; i++) {
            if (line[i] == "<" || line[i] == ">" || line[i] == " " || line[i] == "'" || line[i] == '"' || line[i] == '\r\n') {
                endWord = i;
                break;
            }
        }

        if (endWord > startWord) {
            word2 = line.substring(startWord + 1, endWord);
        }

        return word2;
    }

    private processSearch(
        document: vscode.TextDocument,
        position: vscode.Position): Thenable<vscode.Location[] | null> {

        var DOMParser = require('xmldom').DOMParser;
        let promises_array: Array<any> = [];
        let openedFiles: string[] = [];
        let list: vscode.Location[] = [];
        var fs = require('fs');


        // Run this code only if open files directly
        for (const doc of vscode.workspace.textDocuments) {
            // Skip deployment output environments files 
            if (doc.uri.fsPath.toLowerCase().indexOf("/environments/")) continue;

            promises_array.push(new Promise((resolve: any) => resolve(new FileData(doc.uri, doc.getText()))));
            openedFiles.push(doc.uri.fsPath.toLocaleLowerCase())
        }

        if (vscode.workspace.rootPath) {
            // Run this code only if user open a directory workspace
            for (const file of this.files) {

                // Check if the file is open. If yes, take precedence over unsaved version
                var openedFile = openedFiles.filter(x => x == file.fsPath.toLocaleLowerCase())

                if (openedFile == null || openedFile.length == 0) {
                    promises_array.push(new Promise((resolve: any) => fs.readFile(file.fsPath, 'utf8', function (err: any, data: any) {
                        resolve(new FileData(file, data));
                    })));
                }
            }
        }
        else {

        }

        const word = ReferenceProvider.getSelectedWord(document, position).toLowerCase();

        if (word.length == 0)
            return Promise.resolve(null);

        return Promise.all(promises_array)
            .then((files: any) => {

                for (let file of files) {
                    var data = file.Data.replace(/( )(Id=|Id =|Id  =)/gi, " id=");
                    var doc = new DOMParser().parseFromString(data.toLowerCase());
                    var listLength: number = list.length;

                    // Technical profiles
                    this.searchElement(doc, list, file.Uri, "TechnicalProfile", "Id", word);
                    this.searchElement(doc, list, file.Uri, "ValidationTechnicalProfile", "ReferenceId", word);
                    this.searchElement(doc, list, file.Uri, "ClaimsExchange", "TechnicalProfileReferenceId", word);
                    this.searchElement(doc, list, file.Uri, "OrchestrationStep", "CpimIssuerTechnicalProfileReferenceId", word);
                    this.searchElement(doc, list, file.Uri, "UseTechnicalProfileForSessionManagement", "ReferenceId", word);
                    this.searchElement(doc, list, file.Uri, "IncludeTechnicalProfile", "ReferenceId", word);

                    //Policy name
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "TrustFrameworkPolicy", "PolicyId", word);
                        this.searchElement(doc, list, file.Uri, "PolicyId", null, word);
                    }

                    //Claim definitios
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "OutputClaim", "ClaimTypeReferenceId", word);
                        this.searchElement(doc, list, file.Uri, "InputClaim", "ClaimTypeReferenceId", word);
                        this.searchElement(doc, list, file.Uri, "Value", null, word);
                        this.searchElement(doc, list, file.Uri, "LocalizedCollection", "ElementId", word);
                        this.searchElement(doc, list, file.Uri, "LocalizedString", "ElementId", word);
                        this.searchElement(doc, list, file.Uri, "SubjectNamingInfo", "ClaimType", word);
                        this.searchElement(doc, list, file.Uri, "PersistedClaim", "ClaimTypeReferenceId", word);
                    }
                    //Claim Transformation
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "ClaimsTransformation", "Id", word);
                        this.searchElement(doc, list, file.Uri, "InputClaimsTransformation", "ReferenceId", word);
                        this.searchElement(doc, list, file.Uri, "OutputClaimsTransformation", "ReferenceId", word);
                    }

                    //User journey
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "UserJourney", "Id", word);
                        this.searchElement(doc, list, file.Uri, "DefaultUserJourney", "ReferenceId", word);
                    }

                    //Orchestration steps
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "ClaimsExchange", "Id", word);
                        this.searchElement(doc, list, file.Uri, "ClaimsProviderSelection", "TargetClaimsExchangeId", word);
                        this.searchElement(doc, list, file.Uri, "ClaimsProviderSelection", "ValidationClaimsExchangeId", word);
                    }

                    //Content definition
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "ContentDefinition", "Id", word);
                        this.searchElement(doc, list, file.Uri, "OrchestrationStep", "ContentDefinitionReferenceId", word);
                        this.searchElement(doc, list, file.Uri, "Item", null, word);
                    }

                    //LocalizedResourcesReference
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "LocalizedResourcesReference", "LocalizedResourcesReferenceId", word);
                        this.searchElement(doc, list, file.Uri, "LocalizedResources", "Id", word);
                    }

                    //ClientDefinition
                    if (list.length == listLength) {
                        this.searchElement(doc, list, file.Uri, "ClientDefinition", "Id", word);
                        this.searchElement(doc, list, file.Uri, "ClientDefinition", "ReferenceId", word);
                    }
                }

                if (list.length > 0)
                    return Promise.resolve(list);
                else
                    return Promise.resolve(null);
            });
    }

    private searchElement(
        doc: any,
        list: vscode.Location[],
        uri: vscode.Uri,
        elementTagName: string,
        elementAttribute: string | null,
        word: string) {

        elementTagName = elementTagName.toLowerCase();

        if (elementAttribute != null)
            elementAttribute = elementAttribute.toLowerCase();

        var elements = doc.getElementsByTagName(elementTagName);

        var i: number;
        for (i = 0; i < elements.length; i++) {

            const element = elements[i];
            // If search returns items, add the items to the location arry
            if (element != null &&
                ((elementAttribute != null && (element.getAttribute(elementAttribute) === word)) ||
                    (elementAttribute === null && (element.textContent === word)))) {
                let start: vscode.Position = new vscode.Position(element.lineNumber - 1, element.columnNumber - 1);
                let end: vscode.Position = new vscode.Position(element.lineNumber, 0);

                let loc = new vscode.Location(uri, new vscode.Range(start, end));

                list.push(loc);
            }
        }
    }

}

export class FileData {
    public Uri: vscode.Uri;
    public Data: string;
    public Policy: string;
    public ParentPolicy: string;
    public Level: number;

    constructor(uri: vscode.Uri, data: string) {
        this.Uri = uri;
        this.Data = data;
    }
}