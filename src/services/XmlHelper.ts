import { SelectedWord } from "../models/SelectedWord";
import { SelectedWordXmlElement } from "../models/SelectedWordXmlElement";
import * as vscode from 'vscode';
import { FileData } from "../ReferenceProvider";
const DOMParser = require('xmldom').DOMParser;
import fs = require('fs');
import { TextDocument, Position, Range } from "vscode";

export default class XmlHelper {
    static GetSelectedWordData(
        selectedWord: SelectedWord,
        position: vscode.Position,
        document: vscode.TextDocument) {

        // Load the XML file    
        var xmlDoc = new DOMParser().parseFromString(document.getText().toLowerCase());

        // Get all XML nodes
        var nodeList = xmlDoc.getElementsByTagName("*");

        // var nsAttr = xmlDoc.getElementsByTagName(word.toLowerCase());

        // var i: number;
        // for (i = 0; i < nsAttr.length; i++) {
        //     if (nsAttr[i].lineNumber == position.line || nsAttr[i].lineNumber == (position.line - 1) || nsAttr[i].lineNumber == (position.line + 1)) {

        //         break;
        //     }
        // }


        // Try to get the XML element in the selected range
        for (var i = 0; i < nodeList.length; i++) {
            var node = nodeList[i];

            // TBD: check the column as well
            if (node.lineNumber == (position.line + 1)) {


                let tempNode = node;
                while (tempNode) {
                    selectedWord.Parents.push(XmlHelper.getElementData(tempNode));

                    if (tempNode.parentNode)
                        tempNode = tempNode.parentNode;

                    if (tempNode.nodeName === "#document" || tempNode.nodeName === "trustframeworkpolicy")
                        break;
                }

                break;
            }


        }

        return selectedWord;
    }

    static getElementData(node) {

        var selectedWordXmlElement: SelectedWordXmlElement = new SelectedWordXmlElement();

        // Get information regarding the element
        selectedWordXmlElement.ElementNodeName = node.nodeName;

        if (node.hasAttribute("id"))
            selectedWordXmlElement.ElementID = node.getAttribute("id");

        // Get more element info
        if (selectedWordXmlElement.ElementNodeName === "claimstransformation" && node.hasAttribute("transformationmethod"))
            selectedWordXmlElement.ElementType = node.getAttribute("transformationmethod");

        else if (selectedWordXmlElement.ElementNodeName === "technicalprofile") {

            var docLookupList = node.getElementsByTagName("protocol");
            if (docLookupList.length == 1) {
                if (docLookupList[0].hasAttribute("name") && docLookupList[0].getAttribute("name") === "proprietary" && docLookupList[0].hasAttribute("handler") && docLookupList[0].getAttribute("handler").length > 60 && docLookupList[0].getAttribute("handler").indexOf(",") > 25) {
                    // Extract the provider name
                    selectedWordXmlElement.ElementType = docLookupList[0].getAttribute("handler").substring(0, docLookupList[0].getAttribute("handler").indexOf(","));
                }
                else if (docLookupList[0].hasAttribute("name")) {
                    // Get the protocol name
                    selectedWordXmlElement.ElementType = docLookupList[0].getAttribute("name");
                }
            }
        }

        return selectedWordXmlElement;
    }

    public static GetXmlFilesWithCurrentFile(document: vscode.TextDocument): Thenable<FileData[]> {

        var files: FileData[] = [];

        // Add the current selected file while skipping the deployment output environments files 
        if (document.uri.fsPath.toLowerCase().indexOf("/environments/") == (-1)) {
            files.push(new FileData(document.uri, document.getText().replace(/( )(Id=|Id =|Id  =)/gi, " id=")));
        }

        // Add the rest of open files
        for (const doc of vscode.workspace.textDocuments) {

            // Skip deployment output environments files 
            if (doc.uri.fsPath.toLowerCase().indexOf("/environments/")) continue;

            // Skip selected file
            if (doc.uri != document.uri && doc.uri.scheme != "git")
                files.push(new FileData(doc.uri, doc.getText().replace(/( )(Id=|Id =|Id  =)/gi, " id=")))
        }

        // Run this code only if user open a directory workspace.
        // Get files from the file system
        if (vscode.workspace.rootPath) {

            var promise = vscode.workspace.findFiles(new vscode.RelativePattern(vscode.workspace.rootPath as string, '*.{xml}'))
                .then((uris) => {
                    uris.forEach((uri) => {
                        if (uri.fsPath.indexOf("?") <= 0) {
                            // Check if the file is open. If yes, take precedence over the saved version
                            var openedFile = files.filter(x => x.Uri.fsPath == uri.fsPath)

                            if (openedFile == null || openedFile.length == 0) {
                                var data = fs.readFileSync(uri.fsPath, 'utf8');
                                files.push(new FileData(uri, data.toString().replace(/( )(Id=|Id =|Id  =)/gi, " id=")));
                            }
                        }
                    });
                }).then(() => {
                    return files
                });

            return promise;
        }
        else
            return new Promise(resolve => {
                resolve(files);;
            });

    }

    public static GetFileHierarchy(files: FileData[], file: FileData, hierarchyFiles: FileData[], level: number): FileData[] {

        if (level == 1) {
            file.Level = level;
            hierarchyFiles.push(file);
        }

        var paretnPolicy: FileData[] = files.filter(x => x.Policy == file.ParentPolicy);

        if (paretnPolicy != null && paretnPolicy.length > 0) {
            level++;
            paretnPolicy[0].Level = level;
            hierarchyFiles.push(paretnPolicy[0]);

            hierarchyFiles = XmlHelper.GetFileHierarchy(files, paretnPolicy[0], hierarchyFiles, level);
        }

        return hierarchyFiles.sort(x => x.Level).reverse();
    }

    // Check if current selection is next to a XML attribute
    public static IsCloseToAttribute(attributeName: string, line: string, position: vscode.Position): boolean {

        let index = line.toLowerCase().lastIndexOf(attributeName.toLowerCase())

        if (index == (-1))
            return false;

        index = position.character - (index + attributeName.length + 2);
        return (index >= 0 && index < 15);
    }

    public static IsInNodeAndCloseToAttribute(nodeName: string, attributeName: string, line: string, position: vscode.Position): boolean {

        return (XmlHelper.IsCloseToAttribute(attributeName, line, position) &&
            (line.toLowerCase().indexOf(nodeName.toLowerCase()) > 0) &&
            line.toLowerCase().indexOf(nodeName.toLowerCase()) < position.character);
    }

    public static GetElementIDsByNodeName(nodeName: string, files: FileData[]): string[] {
        var items: string[] = [];

        for (const file of files) {
            var xmlDoc = new DOMParser().parseFromString(file.Data);

            var docLookupList = xmlDoc.getElementsByTagName(nodeName);

            for (let i = 0; i < docLookupList.length; i++) {

                if (docLookupList[i].hasAttribute("id")) {
                    let Id = docLookupList[i].getAttribute("id");

                    if (items.indexOf(Id) == (-1)) {
                        items.push(Id);
                    }
                }
            }
        }

        return items;
    }

    public static IsStartOfOpeningElement(document: TextDocument, position: Position): boolean {
        return XmlHelper.IsTextBeforeTypedWordEqualTo(document, position, '<');
    }

    public static IsStartOfClosingElement(document: TextDocument, position: Position): boolean {
        return XmlHelper.IsTextBeforeTypedWordEqualTo(document, position, '</');
    }

    public static IsEndOfElement(document: TextDocument, position: Position): boolean {
        return XmlHelper.IsTextBeforeTypedWordEqualTo(document, position, '>');
    }

    public static IsCurlyBrackets(document: TextDocument, position: Position): boolean {
        return XmlHelper.IsTextBeforeTypedWordEqualTo(document, position, '{');
    }
    
    public static IsTextBeforeTypedWordEqualTo(document: TextDocument, position: Position, textToMatch: string) {
        let wordRange = document.getWordRangeAtPosition(position);
        let wordStart = wordRange ? wordRange.start : position;
        if (wordStart.character < textToMatch.length) {
            // Not enough room to match
            return false;
        }
        let charBeforeWord = document.getText(new Range(new Position(wordStart.line, wordStart.character - textToMatch.length), wordStart));
        return charBeforeWord === textToMatch;
    }

    public static IsNodeClosed(document: TextDocument, position: Position) {
        let wordRange = document.getWordRangeAtPosition(position);
        let wordStart = wordRange ? wordRange.start : position;

        let charAfterWord = document.getText(new Range(new Position(wordStart.line, wordStart.character + 1), wordStart));
        return charAfterWord === '>';
    }

    public static IsStartOfAttribute(document: TextDocument, position: Position): boolean {
        let wordRange = document.getWordRangeAtPosition(position);
        let wordStart = wordRange ? wordRange.start : position;
        let text = document.getText();
        return XmlHelper.IsTextBeforeTypedWordEqualTo(document, position, ' ') &&
            text.lastIndexOf('<', document.offsetAt(wordStart)) > text.lastIndexOf('>', document.offsetAt(wordStart) - 1);
    }

    // Check if the cursor is about complete the value of an attribute.
    public static IsStartOfAttributeValue(document: TextDocument, position: Position): boolean {
        let wordRange = document.getWordRangeAtPosition(position);
        let wordStart = wordRange ? wordRange.start : position;
        let wordEnd = wordRange ? wordRange.end : position;
        if (wordStart.character === 0 || wordEnd.character > document.lineAt(wordEnd.line).text.length - 1) {
            return false;
        }
        // TODO: This detection is very limited, only if the char before the word is ' or "
        let rangeBefore = new Range(wordStart.line, wordStart.character - 1, wordStart.line, wordStart.character);
        if (document.getText(rangeBefore).match(/'|"/)) {
            return true;
        }
        return false;
    }

    public static GetCloseAttributeName(document: TextDocument, position: Position): string | any {

        // Get the attribute name
        let wordRange = document.getWordRangeAtPosition(position);
        let wordStart = wordRange ? wordRange.start : position;
        let line = document.getText(new Range(wordStart.line, 0, wordStart.line, wordStart.character));
        let attrNamePattern = /[\.\-:_a-zA-Z0-9]+=/g;
        let match = line.match(attrNamePattern);
        if (match) {
            let attrName = match.reverse()[0];
            attrName = attrName.slice(0, -1);

            return attrName;
        }
    }
    // Get the full XPath to the current tag.
    public static GetXPath(document: TextDocument, position: Position): string[] {
        // For every row, checks if it's an open, close, or autoopenclose tag and
        // update a list of all the open tags.
        //{row, column} = bufferPosition
        let xpath: string[] = [];
        let skipList: string[] = [];
        let waitingStartTag = false;
        let waitingStartComment = false;

        // This will catch:
        // * Start tags: <tagName
        // * End tags: </tagName
        // * Auto close tags: />
        let startTagPattern = '<\s*[\\.\\-:_a-zA-Z0-9]+';
        let endTagPattern = '<\\/\s*[\\.\\-:_a-zA-Z0-9]+';
        let autoClosePattern = '\\/>';
        let startCommentPattern = '\s*<!--';
        let endCommentPattern = '\s*-->';
        let fullPattern = new RegExp("(" +
            startTagPattern + "|" + endTagPattern + "|" + autoClosePattern + "|" +
            startCommentPattern + "|" + endCommentPattern + ")", "g");

        // For the first line read, excluding the word the cursor is over
        let wordRange = document.getWordRangeAtPosition(position);
        let wordStart = wordRange ? wordRange.start : position;
        let line = document.getText(new Range(position.line, 0, position.line, wordStart.character));
        let row = position.line;

        while (row >= 0) { //and (!maxDepth or xpath.length < maxDepth)
            row--;

            // Apply the regex expression, read from right to left.
            let matches = line.match(fullPattern);
            if (matches) {
                matches.reverse();

                for (let i = 0; i < matches.length; i++) {
                    let match = matches[i];
                    let tagName;

                    // Start comment
                    if (match === "<!--") {
                        waitingStartComment = false;
                    }
                    // End comment
                    else if (match === "-->") {
                        waitingStartComment = true;
                    }
                    // Omit comment content
                    else if (waitingStartComment) {
                        continue;
                    }
                    // Auto tag close
                    else if (match === "/>") {
                        waitingStartTag = true;
                    }
                    // End tag
                    else if (match[0] === "<" && match[1] === "/") {
                        skipList.push(match.slice(2));
                    }
                    // This should be a start tag
                    else if (match[0] === "<" && waitingStartTag) {
                        waitingStartTag = false;
                    } else if (match[0] == "<") {
                        tagName = match.slice(1);
                        // Omit XML definition.
                        if (tagName === "?xml") {
                            continue;
                        }

                        let idx = skipList.lastIndexOf(tagName);
                        if (idx != -1) {
                            skipList.splice(idx, 1);
                        } else {
                            xpath.push(tagName);
                        }
                    }
                };
            }

            // Get next line
            if (row >= 0) {
                line = document.lineAt(row).text;
            }
        }

        return xpath.reverse();
    }
}



