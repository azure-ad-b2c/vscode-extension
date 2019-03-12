export class Suggestion {
	public InsertText: string;
	public Help: string;
	public HasChildren: boolean;
	public HasContent: boolean;

	constructor() {
        this.HasContent = false;
        this.HasChildren = false;
    }
 
}