export class IefSchema {
    public xpath: string;
    public parentXpath: string;
    public Name: string;
    public Type: string;
    public HasContent: boolean;
    public Description: string;
    constructor() {
    }

    public toString() {
        return this.Name + ' | ' + this.Type + ' | ' + this.xpath + ' | ' + this.parentXpath + ' | ' + this.HasContent + '\r\n';
    }
}