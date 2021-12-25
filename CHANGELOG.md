# Change Log

## August 2021

- Check if the [XML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-xml), or the [XML Tools
](https://marketplace.visualstudio.com/items?itemName=DotJoshJohnson.xml) XML extensions are installed and activated. If yes, let the XML extension handle the XML completion. For more information, see [Troubleshoot policy validity](https://docs.microsoft.com/azure/active-directory-b2c/troubleshoot-custom-policies#troubleshoot-policy-validity).

## March 2021

- User journey and sub journey renumbering ([#41](https://github.com/azure-ad-b2c/vscode-extension/pull/41/)).
- XML elements order on mouseover ([#49](https://github.com/azure-ad-b2c/vscode-extension/pull/49)).

## February 2021

- Added the ability for xml files to be in nested folders.
- New settings: `{Settings:Filename}`, `{Settings:PolicyFilename}`, `{Settings:Environment}`.
- Application insights:
    - Event date format fix.
    - Event shows the error message, technical profiles, validation technical profiles, and claims.
    - Fix related to JSON format issue ([#39](https://github.com/azure-ad-b2c/vscode-extension/pull/39)). 
    - Date range support (in days).
- Policy explorer: 
    - Shows only nodes with elements. 
    - Sub journey has been added to the policy explorer.

## June 2020

- Added option to configure hours for Azure Application Insights trace logs integration.

## May 2020

- [Get B2C application IDs](https://github.com/azure-ad-b2c/vscode-extension#get-b2c-app-ids)

## February 2020

- Policy upload fix
- Update to the latest version of the custom policy XSD file

## July 2019

- Implemented all policies upload command (https://github.com/azure-ad-b2c/vscode-extension/blob/master/src/help/policy-upload.md)

## May 2019

- [Policy upload](https://github.com/azure-ad-b2c/vscode-extension/blob/master/src/help/policy-upload.md) 

## January 2019

- Adding Smart copy and pasted feature
- Fixing the 'add claim type' to include the claim type element's parents 
- New string claim type
- In the policy explorer, adding a link to the root elements such as ClaimsSchema, ClaimsProviders and UserJourneys
- Go to definition now supports navigating to a base policy and link to ClaimsExchange
- Adding autocomplete

## October 2018

- Adding Azure Application Insights trace log integration. Learn more [here](https://github.com/azure-ad-b2c/vscode-extension/blob/master/src/help/app-insights.md)
- Go definition - VS code extension searches the definitions in all files in the working directory 
- Go definition hierarchical search - VS code extension searches the definitions only in the parents policies 
- Mouse over with link to all references
- Policy app settings. For more information, see the readme file.

## May 2018

- **Go to definition** - If the element is not found in the selected file. Or if the selected element points to another file (the XML element is overwritten). The extension search the definition is all open files. 
- **Go to definition** - Always take precedence of editor open files, over the saved version from file system (workspace folder)
- **Add claim type** - New Paragraph, String collection, Integer, Long, and Boolean claim types 
- XML schema quick help

