'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

//Demo: Import classes
import HoverProvider from './HoverProvider';
import GoDefinitionProvider from './GoDefinitionProvider';
import CustomPolicyExplorerProvider from './CustomPolicyExplorerProvider';
import ApplicationInsightsExplorerExplorerProvider from './ApplicationInsightsExplorerExplorerProvider';
import { ReferenceProvider } from './ReferenceProvider';
import InsertCommands from './InsertCommands';
import PolicyBuild from './PolicyBuild';
import SmartCopy from './SmartCopy';
import CompletionProvider from './CompletionProvider';
import XsdHelper from './services/XsdHelper';
import PolicyUpload from './PolicyUpload';
import B2CArtifacts from './B2CArtifacts';
import OrchestrationStepsRenumber from './OrchestrationStepsRenumber';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "aadb2c" is now active!');

    //Demo: Custom Policy Explorer
    const customPolicyExplorerProvider = new CustomPolicyExplorerProvider();
    vscode.window.registerTreeDataProvider('CustomPolicyExplorer', customPolicyExplorerProvider);
    vscode.commands.registerCommand('jsonOutline.refresh', () => customPolicyExplorerProvider.refresh());
    vscode.commands.registerCommand('jsonOutline.refreshNode', offset => customPolicyExplorerProvider.refresh(offset));
    vscode.commands.registerCommand('extension.openJsonSelection', range => customPolicyExplorerProvider.select(range));

    //Demo: Application Insights Explorer
    const applicationInsightsExplorerProvider = new ApplicationInsightsExplorerExplorerProvider(context);
    vscode.window.registerTreeDataProvider('ApplicationInsightsExplorer', applicationInsightsExplorerProvider);
    vscode.commands.registerCommand('ApplicationInsightsExplorer.refresh', () => applicationInsightsExplorerProvider.refresh());
    vscode.commands.registerCommand('ApplicationInsightsExplorer.show', range => applicationInsightsExplorerProvider.show(range));
    vscode.commands.registerCommand('ApplicationInsightsExplorer.settings', range => applicationInsightsExplorerProvider.settings());

    // Register find all reference
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(
            "xml", new ReferenceProvider()));

    // Register go to definition provider
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider([
            { language: 'xml', scheme: 'file', pattern: '**/*xml*' }
        ],
            new GoDefinitionProvider()));

    // Register find all references
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider([
            { language: 'xml', scheme: 'file', pattern: '**/*xml*' }
        ],
            new ReferenceProvider()));

    // Register the hover provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider([
            { language: 'xml', scheme: 'file', pattern: '**/*xml*' }
        ],
            new HoverProvider()
        ));

    // Register the autocomplete provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [
                { language: 'xml', scheme: 'file', pattern: '**/*xml*' }
            ],
            new CompletionProvider(),
            '{', '<', '/', '>', ' ', '"', "'"
        ));

    // Add Claim Type command
    context.subscriptions.push(vscode.commands.registerCommand('extension.insertClaimType', () => InsertCommands.InsertClaimType()));

    // Add Identity provider technical profile command
    context.subscriptions.push(vscode.commands.registerCommand('extension.insertTechnicalProfileIdp', () => InsertCommands.InsertTechnicalProfileIdp()));

    // Add REST API technical profile command
    context.subscriptions.push(vscode.commands.registerCommand('extension.insertTechnicalProfileRESTAPI', () => InsertCommands.InsertTechnicalProfileRESTAPI()));

    // Add application insights command
    context.subscriptions.push(vscode.commands.registerCommand('ApplicationInsightsExplorer.add', () => InsertCommands.InsertApplicationInsights()));

    // Policy build
    context.subscriptions.push(vscode.commands.registerCommand('extension.policy.build', () => PolicyBuild.Build()));

    // Smart copy
    context.subscriptions.push(vscode.commands.registerCommand('extension.policy.smartCopy', () => SmartCopy.Copy()));

    // Smart paste
    context.subscriptions.push(vscode.commands.registerCommand('extension.policy.smartPaste', () => SmartCopy.Paste()));

    // Upload currently open Policy
    context.subscriptions.push(vscode.commands.registerCommand('extension.policy.upload', () => PolicyUpload.uploadCurrentPolicy()));

    // Upload currently open Policy
    context.subscriptions.push(vscode.commands.registerCommand('extension.policy.renumber', () => OrchestrationStepsRenumber.RenumberPolicyDocument()));

    // Upload all policies for the default environment
    context.subscriptions.push(vscode.commands.registerCommand('extension.policy.uploadAll', () => PolicyUpload.uploadAllPolicies()));

    // Update appSettings with IEF appIds and B2C extension app id and object id
    context.subscriptions.push(vscode.commands.registerCommand('extension.settings.b2cArtifacts', () => B2CArtifacts.GetB2CArtifacts()));

    // Load IEF schema
    XsdHelper.getIefSchema();
}

// this method is called when your extension is deactivated
export function deactivate() {
}
