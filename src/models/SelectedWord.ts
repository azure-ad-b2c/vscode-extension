import { SelectedWordXmlElement } from "./SelectedWordXmlElement";

export class SelectedWord {
	public Value: string;
	public Title: string;
	public IsTag: boolean;

	public Parents: Array<SelectedWordXmlElement> = new Array<SelectedWordXmlElement>();

	public GetSelectedElement() {
		if (this.Parents.length > 0)
			return this.Parents[0];
		else
			return new SelectedWordXmlElement();
	}

	
	public GetSelectedParentElement() {
		if (this.Parents.length >= 2)
			return this.Parents[1];
		else
			return new SelectedWordXmlElement();
	}

	public GetSelectedGrandParentElement() {
		if (this.Parents.length >= 3)
			return this.Parents[2];
		else
			return new SelectedWordXmlElement();
	}
	public GetFirstElementWithId() {
		for (let entry of this.Parents) {
			if (entry.ElementID && entry.ElementID != "")
				return entry;
		}

		return new SelectedWordXmlElement();
	}

	public GetFirstElementWithNodeName(nodeName: string) {
		for (let entry of this.Parents) {
			if (entry.ElementNodeName === nodeName)
				return entry;
		}

		return new SelectedWordXmlElement();
	}

	public ContainsNodeName(nodeName: string): boolean {
		for (let entry of this.Parents) {
			if (entry.ElementNodeName === nodeName)
				return true;
		}

		return false;
	}
	public GetFirstElementWithType() {
		for (let entry of this.Parents) {
			if (entry.ElementType && entry.ElementType != "")
				return entry;
		}

		return new SelectedWordXmlElement();
	}

}

