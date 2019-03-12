export class Metadata {
	public Protocol: string;
	public Key: string;

	constructor (p: string, key: string)
	{
		this.Key = key;
		this.Protocol = p;
	}
 
}