import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationTarget } from 'vscode';
const clipboardy = require('clipboardy');

class AppInsightsItem {
	Id: String;
	Tenant: String;
	UserJourney: String;
	OrchestrationStep: String;
	CorrelationId: String;
	Timestamp: String;
	Data: String;
	HasException: boolean;

	constructor(id: String, tenant: String, userJourney: String, orchestrationStep: String, correlationId: String, timestamp: String, data: String, hasException: boolean) {
		this.Id = id;
		this.Tenant = tenant;
		this.UserJourney = userJourney;
		this.OrchestrationStep = orchestrationStep;
		this.CorrelationId = correlationId;
		this.Timestamp = timestamp;
		this.Data = data;
		this.HasException = hasException;
	}
}

export default class ApplicationInsightsExplorerExplorerProvider implements vscode.TreeDataProvider<String> {

	_onDidChangeTreeData: vscode.EventEmitter<String | null> = new vscode.EventEmitter<String | null>();
	readonly onDidChangeTreeData: vscode.Event<String | null> = this._onDidChangeTreeData.event;

	editor: vscode.TextEditor;
	autoRefresh: boolean = false;
	AppInsightsItems: AppInsightsItem[] = [];
	panel;
	panelConfig;
	error: String = "";
	appInsightsImageFile = null;

	constructor(private context: vscode.ExtensionContext) {

		this.editor = vscode.window.activeTextEditor as vscode.TextEditor;
		vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
		this.parseTree();
		this.onActiveEditorChanged();

		// Get path to resource on disk
		this.appInsightsImageFile = vscode.Uri.file(
			path.join(context.extensionPath, 'media', 'app-insights-api-key.png')
		  );
	
	}

	refresh(Initiator?: String): void {
		this.parseTree();
	}

	onActiveEditorChanged(): void {
		if ((this.panel && this.panel.visible) ||
			(this.panelConfig && this.panelConfig.visible) ||
			(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file' && vscode.window.activeTextEditor.document.languageId === 'xml')) {
			vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', true);
		}
		else {
			vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', false);
		}
	}

	parseTree(): void {
		this.error = 'loading';

		var request = require('request');

		// Check the configuration
		var config = vscode.workspace.getConfiguration('aadb2c.ai');

		if (!config || (!config.id && !config.key))
			this.error = "Application insights configuration not found";
		else if (!config.id)
			this.error = "Application insights Id not found";
		else if (!config.key)
			this.error = "Application insights Key not found";

		if (this.error && this.error != 'loading') {
			this._onDidChangeTreeData.fire(null)
			return;
		}
		else if (this.error && this.error == 'loading') {
			this._onDidChangeTreeData.fire(null)
		}

		// Prepare the Application insights call
		var timespan = '';

        if (config.timespan > 0) {
            let d = new Date();
            d.setDate(d.getDate() - config.timespan);

            timespan = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + "/";
        }

        var url = 'https://api.applicationinsights.io/v1/apps/' + config.id
            + '/events/traces?timespan=' + timespan + "PT" + config.duration + 'H'
            + "&$filter=startswith(customDimensions/EventName, 'Journey Recorder')"
            + '&$top=' + config.maxRows
            + '&$orderby=timestamp desc&$select=id,timestamp,trace/message,customDimensions'

        // Prepare the Application insights call
        var options = {
            url: url,
			headers: {
				'X-API-Key': config.key
			}
		};

		// Application insights call-back function
		function callback(this: ApplicationInsightsExplorerExplorerProvider, error, response, body) {
			if (!error && response.statusCode == 200) {
				this.error = "";
				var info = null;
				
				try {
					info = JSON.parse(body);
				}
				catch (e) {
					try {
						// I'm unclear why this replace exists, but removing it fixes the unexpected token c error
						// Instead of immediately going for the replace, try parsing the body as is and then falling back to the replace as a last resort
						body = body.replace('""', '"')
						info = JSON.parse(body);
					} catch (e2) {
						console.log(e.message)
						vscode.window.showErrorMessage(e.message);
						this.error = "Cannot parse the json data.";
						this._onDidChangeTreeData.fire(null);
						return;
					}
				}

				this.AppInsightsItems = [];
				for (var i = 0; i < info.value.length; i++) {
					var element = info.value[i];

					// Find the orchestration steps
					var startIndex = 0, index, currentStep = '';
					while ((index = element.trace.message.indexOf('CurrentStep', startIndex)) > -1) {
						startIndex = index + 'CurrentStep'.length;
						index = element.trace.message.indexOf(':', index);
						var endOfRaw = element.trace.message.indexOf('\r\n', index);
						currentStep += element.trace.message.substring(index + 1, endOfRaw).trim() + ', ';
					}

					if (currentStep.length > 1) {
						currentStep = "Step " + currentStep.substr(0, currentStep.length - 2);
					}

					this.AppInsightsItems.push(new AppInsightsItem(
						info.value[i].id,
						info.value[i].customDimensions.Tenant,
						info.value[i].customDimensions.UserJourney,
						currentStep,
						info.value[i].customDimensions.CorrelationId,
						info.value[i].timestamp,
						element.trace.message,
						(element.trace.message.indexOf('Exception') > 0)
					));
				}

				this._onDidChangeTreeData.fire(null)
			}
			else if (response.statusCode == 404) {
				vscode.window.showErrorMessage("Wrong Application insights Id");
				this.error = "Wrong Application insights Id";
				this._onDidChangeTreeData.fire(null);
			}
			else if (response.statusCode == 403) {
				vscode.window.showErrorMessage("The provided credentials have insufficient access to perform the requested operation. Check your application key.");
				this.error = "The provided credentials have insufficient access to perform the requested operation. Check your application key.";
				this._onDidChangeTreeData.fire(null);
			} else {
				vscode.window.showErrorMessage(body);
				this.error = "General error";
				this._onDidChangeTreeData.fire(null);
			}
		}

		// CallApplication insights REST API endpoint
		request(options, callback.bind(this));
	}


	getChildren(parentElementKey?: String): Thenable<String[]> {
		const keys: String[] = [];

		if (this.error != "" && this.error != "loading") {
			keys.push("Error|" + this.error);
		}
		else if (this.error != "" && this.error == "loading") {
			keys.push("Error|Loading...");
		}
		else if (this.AppInsightsItems.length == 0) {
			keys.push("Error|Application Insights produced empty results.");
		}
		else {
			if (!parentElementKey) {
				// Load the root elements (user journeys)
				var distinct: String[] = [];
				for (var i = 0; i < this.AppInsightsItems.length; i++) {
					var userJourney = this.AppInsightsItems[i].UserJourney;
					if (distinct.indexOf(userJourney) > (-1)) continue;
					{
						distinct.push(userJourney);
						keys.push("UserJourney|" + userJourney);
					}
				}
				keys.sort();
			}
			else {
				const elementValues: String[] = parentElementKey.split("|");

				// Load the root elements' children
				if (elementValues[0] == "UserJourney") {

					// Load the list of correction IDs
					var distinct: String[] = [];
					for (var i = 0; i < this.AppInsightsItems.length; i++) {

						var correlationId = this.AppInsightsItems[i].CorrelationId;

						if (elementValues[1] != this.AppInsightsItems[i].UserJourney ||
							distinct.indexOf(correlationId) > (-1)) continue;
						{
							distinct.push(correlationId);

							// Get the first date and time of this correlation id
							var minTimestamp;
							for (var x = 0; x < this.AppInsightsItems.length; x++) {
								if (this.AppInsightsItems[x].CorrelationId != correlationId) continue;
								{
									var timestamp = new Date(this.AppInsightsItems[x].Timestamp.toString());
									if (!minTimestamp || timestamp < minTimestamp)
										minTimestamp = timestamp;
								}
							}
							keys.push("CorrelationId|" + this.formatDate(minTimestamp) + " (" + correlationId.split("-")[0] + ")|" + correlationId);
						}
					}
					keys.sort().reverse();
				}
				else if (elementValues[0] == "CorrelationId") {
					// Load the list of orchestration steps
					for (var i = 0; i < this.AppInsightsItems.length; i++) {
						var correlationId = this.AppInsightsItems[i].CorrelationId;
						if (elementValues[2] != correlationId) continue;
						{
							var timestamp = new Date(this.AppInsightsItems[i].Timestamp.toString());
							var setp = this.AppInsightsItems[i].OrchestrationStep ? " (" + this.AppInsightsItems[i].OrchestrationStep + ")" : "";
							keys.push("OrchestrationStep|" + this.formatDate(timestamp) + setp + "|" + this.AppInsightsItems[i].Id + "|" + this.AppInsightsItems[i].HasException);
						}
					}
					keys.sort();
				}
			}

		}

		return Promise.resolve(keys);
	}

	//Convert duration into ISO8601 format.
	formatDurationISO8601(duration: Number) {
		const dateTime = new Date()
		return new Date(dateTime.getTime() - (1000 * 60 * 60 * Number(duration))).toISOString()

	}
	formatDate(date: Date) {
		return date.getFullYear().toString() + "-" + this.pad(date.getMonth()) + "-" + this.pad(date.getDate()) + " " + this.pad(date.getHours()) + ":" + this.pad(date.getMinutes()) + ":" + this.pad(date.getSeconds());
	}
	pad(date: number) {
		return date.toString().length < 2 ? "0" + date : date;
	}

	getTreeItem(elementKey: String): vscode.TreeItem {

		let treeItem: vscode.TreeItem;
		const elementValues: String[] = elementKey.split("|");

		if (elementValues[0] == "UserJourney") {
			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.Expanded);
		}
		else if (elementValues[0] == "CorrelationId") {
			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.Collapsed);
		}
		else if (elementValues[0] == "Error") {
			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.None);
			treeItem.iconPath = this.getIcon("warning.svg");
		}
		else {

			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.None);

			treeItem.command = {
				command: 'ApplicationInsightsExplorer.show',
				title: '',
				arguments: [elementValues[2]]
			};

			if (elementValues[3] === 'true') {
				treeItem.iconPath = this.getIcon("warning.svg");
			}
		}

		return treeItem;
	}

	getIcon(fileName: String): any {
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'light', fileName.toString())),
			dark: this.context.asAbsolutePath(path.join('resources', 'dark', fileName.toString()))
		}
	}

	show(id: String) {

		for (var i = 0; i < this.AppInsightsItems.length; i++) {
			if (id != this.AppInsightsItems[i].Id) continue;
			{
				if (!this.panel)
					this.panel = vscode.window.createWebviewPanel('ApplicationInsightsData', "Application Insights Explorer", vscode.ViewColumn.One, {
						// Enable scripts in the webview
						enableScripts: true
					});

				// Handle messages from the webview
				this.panel.webview.onDidReceiveMessage(message => {
					clipboardy.writeSync(message.text);

				}, undefined, undefined);

				this.panel.onDidDispose(() => {
					// When the panel is closed, cancel any future updates to the webview content
					this.panel = null;
				}, null, null);

				// And set its HTML content
				this.panel.webview.html = this.getWebviewContent(this.AppInsightsItems[i]);
				this.panel.reveal();
				this.panel.onDidChangeViewState((e) => {
					if (e.webviewPanel._visible) {
						vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', true);
					}
				})

				break;
			}
		}
	}

	getWebviewContent(appInsightsItem: AppInsightsItem) {
		var data = appInsightsItem.Data.toString();
		var json = null;
		var technicalProfiles = '';
		var validationTechnicalProfiles = '';
		var exceptions = '';
		var claimsString = '';
		var journeyIsCompleted = 'No';

		try {
			json = JSON.parse(data);
		} catch (e) {
			// When this would fail previously, VS Code would silently ignore the error and continue, returning no content
			// to the user when they tried to view the app insights file
			console.log("Failed to parse app insights JSON data: " + e.message);
		}

		// If the json object is null, it means it couldn't be parsed. This happens when the JSON object is incomplete which
		// occurs when the app insights trace is large
		if (json !== null) {
			var jp = require('jsonpath'); //https://jsonpath.com/ and https://www.npmjs.com/package/jsonpath

			// Get the list of technical profiles 
			var collection = jp.query(json, '$..Values[?(@.Key=="InitiatingClaimsExchange")]');
			
			for (var i in collection) {
				technicalProfiles += '<li>' + collection[i].Value.TechnicalProfileId + ' (' + collection[i].Value.ProtocolProviderType + ')</li>';
			}
			if (technicalProfiles.length > 1) {
				technicalProfiles = "<li>Technical profiles:<ol>" + technicalProfiles + "</ol></li>";
			}
			// Get the list of validation technical profiles 
			collection = jp.query(json, '$..Values[?(@.Key=="TechnicalProfileId")]');
			
			for (var i in collection) {
				validationTechnicalProfiles += '<li>' + collection[i].Value + '</li>';
			}

			if (validationTechnicalProfiles.length > 1) {
				validationTechnicalProfiles = "<li>Validation technical profiles:<ol>" + validationTechnicalProfiles + "</ol></li>";
			}
			// Get the fatal exceptions
			collection = jp.query(json, '$..Exception');

			
			for (var i in collection) {
				exceptions += '<li>' + collection[i].Message + '</li>';
			}

			// Get the exceptions
			collection = jp.query(json, '$..Values[?(@.Key=="Exception")].Value');

			for (var i in collection) {
				exceptions += '<li>' + collection[i].Message + '</li>';
			}

			if (exceptions.length > 1) {
				exceptions = "<li><span style='color: red;'>Exceptions:</span><ol>" + exceptions + "</ol></li>";
			}
			// Get the claims
			var normalizedJson = JSON.parse(appInsightsItem.Data.toString().replace(new RegExp('Complex\-CLMS', "g"), "ComplexCLMS"))
			collection = jp.query(normalizedJson, '$..ComplexCLMS');

			var claims = {};
			for (var i in collection) {
				var p = collection[i];

				for (var key of Object.keys(p)) {
					console.log(key + " -> " + p[key])

					// Check if the claim isn't in the collection
					if (!claims[key]) {
						// Add a claim to the collection. And set the first element in the values collection
						claims[key] = [p[key]];
					}
					else {
						// Get the last element in the claim's values collection
						var lastObject = claims[key].length - 1;

						// If the last element value isn't the same, then add the new value to the values collection
						if (claims[key][lastObject] != p[key]) {
							claims[key][lastObject + 1] = p[key];
						}
					}
				}
			}
			for (var key of Object.keys(claims)) {
				claimsString += "<li>" + key + ": ";
				for (var i in claims[key]) {
					claimsString += claims[key][i] + " => "
				}
				if (claimsString.length > 4)
					claimsString = claimsString.slice(0, -4);
				claimsString += "</li>";
			}
	
			if (claimsString.length > 1) {
				claimsString = "<li>Claims:<ul>" + claimsString + "</ul></li>";
			}

			// Get Journey is completed
			collection = jp.query(json, '$..Values[?(@.Key=="JourneyCompleted")]');
			if (collection.length > 0) journeyIsCompleted = "Yes";
		} else {
			journeyIsCompleted = "Unknown (JSON parse exception)";
		}

		// Return the HTML page
		return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Application Insights Explorer</title>
	<style>
		body.vscode-light {
			color: black;
		}
		
		body.vscode-dark {
			color: white;
		}
		
		body.vscode-high-contrast {
			color: red;
		}

		li
		{
			line-height: 1.8;
		}
		.highlight {
			background-color: #ffff66;
		  }
	</style>
	<script>
		function copyJson() {
			const vscode = acquireVsCodeApi();
			const json = document.getElementById('json');

			vscode.postMessage({
				text: json.innerText
			});
		}
		function highlight() {
			
			var json = document.getElementById("json");
			var jsonHidden = document.getElementById("jsonHidden");
			var searchbox = document.getElementById("searchbox");
						
			json.innerHTML = jsonHidden.innerText.replace(new RegExp(searchbox.value.trim(), "gi"), "<span id='highlight' class='highlight'>" + searchbox.value.trim() + "</span>")

			var elmnts = document.querySelectorAll("#highlight");

			if (elmnts.length > 0)
				elmnts[0].scrollIntoView();
		  }
	</script>	
	</head>
	<body>
		  <h1>Application Insights</h1>
		<ul>
  			<li>User Journey: ` + appInsightsItem.UserJourney + `</li>
  			<li>Correlation Id: ` + appInsightsItem.CorrelationId + `</li>
			<li>App insights Id: ` + appInsightsItem.Id + `</li>
			<li>App insights timestamp: ` + this.formatDate(new Date(appInsightsItem.Timestamp.toString())) + `</li>
			<li>User journey is completed: ` + journeyIsCompleted + `</li>
			<li>Orchestration steps: ` + appInsightsItem.OrchestrationStep.replace("Step", "") + `</li>
			` + exceptions + `
			` + technicalProfiles + `
			` + validationTechnicalProfiles + `
			` + claimsString + `
		</ul>
		<h2>Application Insights JSON</h2>
		<input type="button" onclick="copyJson()" id="copyJson" value="copy log to clipboard" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
		<input type="text" id="searchbox" />
		<input type="button" onclick="highlight()" value="Search" />
		<pre><code id='json'>` + appInsightsItem.Data + `</code></pre>
		<pre><code id='jsonHidden' style='display: none;'>` + appInsightsItem.Data + `</code></pre>
	</body>
	</html>`;


	}

	settings() {

		if (!this.panelConfig)
			this.panelConfig = vscode.window.createWebviewPanel('ApplicationInsightsSettings', "Application Insights Settings", vscode.ViewColumn.One, {
				// Enable scripts in the webview
				enableScripts: true
			});

		// Handle messages from the webview
		this.panelConfig.webview.onDidReceiveMessage(message => {

			// Load the configuration
			var config = vscode.workspace.getConfiguration('aadb2c.ai');

			var configurationTarget: ConfigurationTarget = ConfigurationTarget.Workspace;
			// Run this code only if user open a directory workspace
			if (!vscode.workspace.rootPath) {
				configurationTarget = ConfigurationTarget.Global;
			}

			config.update("id", message.id, configurationTarget);
			config.update("key", message.key, configurationTarget);
			config.update("maxRows", Number(message.maxRows), configurationTarget);
			config.update("timespan", Number(message.timespan), configurationTarget);
			config.update("duration", Number(message.duration), configurationTarget);

			this.panelConfig.dispose();

			// Trick, place a delay and the values get loaded
			setTimeout(() => this.refresh(), 2500);

		}, undefined, undefined);

		this.panelConfig.onDidDispose(() => {
			// When the panel is closed, cancel any future updates to the webview content
			this.panelConfig = null;
		}, null, null);

		// And set its HTML content
		this.panelConfig.webview.html = this.getSettingsWebviewContent();
		this.panelConfig.reveal();
	}

	getSettingsWebviewContent() {

		// Load the configuration
		var config = vscode.workspace.getConfiguration('aadb2c.ai');
		var targetConfigFile: String = "";
		var title: String;

		if (vscode.workspace.rootPath) {
			title = "Application Insights Settings (workspace)";
			targetConfigFile = "<b>Workspace folder</b> settings file is located here:<br />" + path.join(vscode.workspace.rootPath, ".vscode", "settings.json");
		}
		else {
			title = "Application Insights Settings (global)";
			targetConfigFile = `Depending on your platform, the <b>global</b> user settings file is located here:
			<ul>
				<li><b>Windows</b> %APPDATA%\\Code\\User\\settings.json</li>
				<li><b>macOS</b> $HOME/Library/Application Support/Code/User/settings.json</li>
				<li><b>Linux</b> $HOME/.config/Code/User/settings.json</li>
			</ul>`;
		}

		var timespanOptions = '';

        for (var i = 0; i < 61; i++) {
            timespanOptions += "<option value='" + i + "' " + ((i == config.timespan) ? 'selected' : '') + ">" + ((i == 0) ? 'Now' : i + ' days ago') + "</option>";
        }

		return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Application Insights Explorer</title>
	<style>
		body.vscode-light {
			color: black;
		}
		
		body.vscode-dark {
			color: white;
		}
		
		body.vscode-high-contrast {
			color: red;
		}
	</style>
	<script>
		function save() {
			const vscode = acquireVsCodeApi();
			const id = document.getElementById('id');
			const key = document.getElementById('key');
			const maxRows = document.getElementById('maxRows');
			const duration = document.getElementById('duration');
			const timespan = document.getElementById('timespan');
			
			vscode.postMessage({
				id: id.value,
				key: key.value, 
				maxRows: maxRows.value, 
				timespan: timespan.value,
				duration: duration.value,
			})
		}

		function showKey()
		{
			var key = document.getElementById("key");
			var keyShow = document.getElementById("keyShow");

			if (key.type === "password")
			{
				key.type = "text";
				keyShow.innerHTML = 'hide';
			}
			else
			{
				key.type = "password";
				keyShow.innerHTML = 'show';
			}
		}
		function showAppIdAndKey()
		{
			var getAppIdAndKey = document.getElementById("getAppIdAndKey");

			if (getAppIdAndKey.style.display === "none")
			{
				getAppIdAndKey.style.display = '';
			}
			else
			{
				getAppIdAndKey.style.display = 'none';
			}
		}
	</script>	
	</head>
	<body style="font-family: Verdana, Helvetica, Menlo, Monaco, 'Courier New', monospace; line-height: 1.6;">
		<H1>` + title + `</h3>

		If you haven't already done so, <a href='https://docs.microsoft.com/azure/active-directory-b2c/troubleshoot-with-application-insights'>set up Application Insights, and Configure the custom policy</a>, then <a href='javascript:void(0)' onclick='showAppIdAndKey(); return false;'>get your Application Insights ID and key.</a>
		
		<span id="getAppIdAndKey" style="display: none">
		<h2>Getting your Application Insights ID and key</h2>

		The <b>API ID</b> and <b>API key</b> are used by Azure AD B2C extension to <b>read</b> the Application Insights events (telemetries). Your API keys should be managed like passwords. Keep it secret.

		<br />&nbsp;<br />
		
		Note: Application Insights <a href='https://docs.microsoft.com/azure/active-directory-b2c/troubleshoot-with-application-insights'>instrumentation key</a> is required to <b>send</b> Azure AD B2C telemetries to Application Insights.
		You use the <b>instrumentation key</b> only in your Azure AD B2C policy, not here.
		<br />&nbsp;<br />
		To get Application Insights ID and key:
		<ol>
			<li>In Azure portal, open the Application Insights resource for your application.</li>
			<li>Select <b>Settings</b>, and then select <b>API Access</b>.</li>
			<li>Copy the Application ID</li>
			<li>Click on Create API Key</li>
			<li>Check the Read telemetry box.</li>
			<li>Copy the key before closing the Create API key blade and save it somewhere secure. (If you lose the key, you'll need to create another.)</li>
		</ol>

		<img src='` + this.panelConfig.webview.asWebviewUri(this.appInsightsImageFile) + `' />
		</span>
		<h2>Application Insights settings</h2>
		<table>
		<tr>
			<td>Your Application ID</td>
			<td><input type="text" id="id" value="` + config.id + `" size="40"></td>
		</tr>
		<tr>
			<td>Your Application key (secret)</td>
			<td><input type="password" id="key" value="` + config.key + `" size="40"> <a href='javascript:void(0)' onclick='showKey(); return false;' id='keyShow'>show</a></td>
		</tr>
		<tr>
			<td>The number of events to return</td>
			<td><input type="number" id="maxRows" value="` + config.maxRows + `"  min="1" max="50" style="min-width: 50px;"></td>
		</tr>
		<tr>
			<td>Returns events from</td>
			<td><select id="timespan">
				`
				+ timespanOptions +
				`
	  		</select></td>
		</tr>
		<tr>
			<td>The duration of events to return (in hours)</td>
			<td><input type="number" id="duration" value="` + config.duration + `"  min="1" max="72" size="40" style="min-width: 50px;"></td>
		</tr>
		<tr>
			<td></td>
			<td><input type="button" onclick="save()" id="save" value="Save"></td>
		</tr>
		</table>

		<H2>Settings file locations</H2>
		` + targetConfigFile + `
	</body>
	</html>`;
	}


}