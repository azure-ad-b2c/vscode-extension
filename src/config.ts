import fs = require('fs');
import * as vscode from 'vscode';

export default class Config {

    static GetDefaultEnvironment(): string {
        return vscode.workspace.getConfiguration().get("environment.default") as string;
    }

    static GetEnvironments(): Promise<Array<any>> {
        return new Promise((resolve, reject) =>
            fs.readFile(`${vscode.workspace.rootPath}/appsettings.json`, (err, data) => {
                if (err) {
                    vscode.window.showErrorMessage("Error reading the appsettings.json file. Run Build Policy command to create default appsettings.json file");
                    reject(err);
                }
                else {
                    resolve(JSON.parse(data.toString()).Environments);
                }
            }));
    }

    static async GetEnvironment(name: string) {
        return (await this.GetEnvironments()).find(item => item.Name == name);
    }
}
