# Change Log

## January 2019
- Adding Smart copy and pasted feature
- Fixing the 'add claim type' to include the claim type element's parents 
- New string claim type
- In the policy explorer, adding a link to the root elements such as ClaimsSchema, ClaimsProviders and UserJourneys
- Go to definition now supports navigating to a base policy and link to ClaimsExchange
- Adding autocomplete

## October 2018
- Adding Azure Application Insights trace log integration. Learn more [here](https://github.com/yoelhor/aad-b2c-vs-code-extension/blob/master/src/help/app-insights.md)
- Go definition - VS code extension searches the definitions in all files in the working directory 
- Go definition hierarchical search - VS code extension searches the definitions only in the parents policies 
- Mouse over with link to all references
- Policy app settings. For more information, see the readme file.

## May 2018
- **Go to definition** - If the element is not found in the selected file. Or if the selected element points to another file (the XML element is overwritten). The extension search the definition is all open files. 
- **Go to definition** - Always take precedence of editor open files, over the saved version from file system (workspace folder)
- **Add claim type** - New Paragraph, String collection, Integer, Long, and Boolean claim types 
- XML schema quick help

