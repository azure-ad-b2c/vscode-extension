
export class KeywordData {
    public Keyword: string;
    public KeywordLowerCase: string;

    public ParentKeyword: string;
    public ParentKeywordLowerCase: string;

    public Text: string;
    public Url: string | null;

    constructor(parentKeyword: string, keyword: string, text: string, url: string | null) {
        this.Keyword = keyword;
        this.KeywordLowerCase = this.Keyword.toLowerCase();

        this.ParentKeyword = parentKeyword;
        this.ParentKeywordLowerCase = this.ParentKeyword.toLowerCase();

        this.Text = text;
        this.Url = url;
    }
}