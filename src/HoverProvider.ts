import * as vscode from 'vscode';
import { Hover } from 'vscode';
import GoDefinitionProvider from './GoDefinitionProvider';
import path = require('path');
import { ReferenceProvider } from './ReferenceProvider';
import { SelectedWord } from './models/SelectedWord';
import XmlHelper from './services/XmlHelper';

export default class HoverProvider {

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken): Thenable<Hover> {

        // Get the selected word
        var selectedWord: SelectedWord = new SelectedWord();
        selectedWord.Title = ReferenceProvider.getSelectedWord(document, position);
        selectedWord.Value = selectedWord.Title.toLocaleLowerCase();

        if (selectedWord.Value.length == 0)
            return new Promise((resolve) => resolve());

        // Check if the selected word is a XML element (not a value)    
        selectedWord.IsTag = ReferenceProvider.isTagSelected(document, position);

        // Get more information regarding the selected word	
        selectedWord = XmlHelper.GetSelectedWordData(selectedWord, position, document);

        if (selectedWord.IsTag) {
            return new Promise(resolve => {
                resolve(new Hover(this.GetHelp(selectedWord)));
            });
        }
        else {
            var goDefinitionProvider: GoDefinitionProvider = new GoDefinitionProvider();

            var promise = goDefinitionProvider.provideDefinitionExt(document, position, token, true)
                .then((locations) => {
                    var message: String = "**" + selectedWord.Title + "**\r\n\r\n";

                    var locs: vscode.Location[] = locations as vscode.Location[];

                    for (var i = 0; i < locs.length; i++) {
                        message += "[" + path.basename(locations[i].uri.toString()) + "](" + locations[i].uri._formatted + "#" + locations[i].range.start.line + ")\r\n\r\n";
                    }

                    if (locs.length > 0)
                        return new Hover(message.toString());
                    else
                        return new Hover("");
                })
                .then((hover) => {
                    return hover;
                });

            return promise;

        }
    }

    GetHelp(selectedWord: SelectedWord): string {

        var message = "";
        var links: string[] = [];

        if (selectedWord.GetSelectedElement().ElementNodeName === "TrustFrameworkPolicy".toLocaleLowerCase()) {
            links.push("TrustFrameworkPolicy|https://docs.microsoft.com/en-us/azure/active-directory-b2c/trustframeworkpolicy")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "BasePolicy".toLocaleLowerCase()) {
            links.push("Base policy|https://docs.microsoft.com/en-us/azure/active-directory-b2c/trustframeworkpolicy#base-policy")
            links.push("Trust Framework Policy|https://docs.microsoft.com/en-us/azure/active-directory-b2c/trustframeworkpolicy")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "BuildingBlocks".toLocaleLowerCase()) {
            links.push("Building Blocks|https://docs.microsoft.com/en-us/azure/active-directory-b2c/buildingblocks")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "ClaimsSchema".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "ClaimType".toLocaleLowerCase()) {
            links.push("Claims definition|https://docs.microsoft.com/en-us/azure/active-directory-b2c/claimsschema")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "ClaimsTransformations".toLocaleLowerCase()) {
            links.push("Claims Transformations|https://docs.microsoft.com/en-us/azure/active-directory-b2c/claimstransformations")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "Predicates".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "Predicate".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "PredicateValidations".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "PredicateValidation".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "PredicateGroups".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "PredicateGroup".toLocaleLowerCase()) {
            links.push("Predicates and PredicateValidations|https://docs.microsoft.com/en-us/azure/active-directory-b2c/predicates")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "ContentDefinitions".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "ContentDefinition".toLocaleLowerCase()) {
            links.push("Content Definitions|https://docs.microsoft.com/en-us/azure/active-directory-b2c/contentdefinitions");
            links.push("Localization|https://docs.microsoft.com/en-us/azure/active-directory-b2c/localization");
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "ClaimsProviders".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "ClaimsProvider".toLocaleLowerCase()) {
            links.push("Claims Providers|https://docs.microsoft.com/en-us/azure/active-directory-b2c/claimsproviders")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "UserJourneys".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "UserJourney".toLocaleLowerCase()) {
            links.push("User Journeys|https://docs.microsoft.com/en-us/azure/active-directory-b2c/userjourneys")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "OrchestrationSteps".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "OrchestrationStep".toLocaleLowerCase()) {
            links.push("Orchestration Steps|https://docs.microsoft.com/en-us/azure/active-directory-b2c/userjourneys#orchestrationsteps")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "ClaimsProviderSelections".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "ClaimsProviderSelection".toLocaleLowerCase()) {
            links.push("Claims Provider Selection|https://docs.microsoft.com/en-us/azure/active-directory-b2c/userjourneys#claimsproviderselection")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "ClaimsExchanges".toLocaleLowerCase() ||
            selectedWord.GetSelectedElement().ElementNodeName === "ClaimsExchange".toLocaleLowerCase()) {
            links.push("Claims Exchange|https://docs.microsoft.com/en-us/azure/active-directory-b2c/userjourneys#claimsexchanges")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "RelyingParty".toLocaleLowerCase()) {
            links.push("Relying Party Policy|https://docs.microsoft.com/en-us/azure/active-directory-b2c/relyingparty")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "DefaultUserJourney".toLocaleLowerCase()) {
            links.push("DefaultUserJourney|https://docs.microsoft.com/en-us/azure/active-directory-b2c/relyingparty#defaultuserjourney")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "UserJourneyBehaviors".toLocaleLowerCase()) {
            links.push("UserJourneyBehaviors|https://docs.microsoft.com/en-us/azure/active-directory-b2c/relyingparty#userjourneybehaviors")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "JourneyInsights".toLocaleLowerCase()) {
            links.push("JourneyInsights|https://docs.microsoft.com/en-us/azure/active-directory-b2c/relyingparty#journeyinsights")
            links.push("Collecting Logs|https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-troubleshoot-custom")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "ContentDefinitionParameters".toLocaleLowerCase()) {
            links.push("ContentDefinitionParameters|https://docs.microsoft.com/en-us/azure/active-directory-b2c/relyingparty#contentdefinitionparameters")
        }
        // Technical profiles help
        else if (selectedWord.GetSelectedElement().ElementNodeName === "technicalprofile") {

            switch (selectedWord.GetSelectedElement().ElementType) {
                case "openidconnect": {
                    links.push("OpenId Connect technical profile|https://docs.microsoft.com/en-us/azure/active-directory-b2c/openid-connect-technical-profile")
                    break;
                }
                case "oauth2": {
                    links.push("OAuth2 technical profile|https://docs.microsoft.com/en-us/azure/active-directory-b2c/oauth2-technical-profile")
                    break;
                }
                case "oauth1": {
                    links.push("OAuth1 technical profile|https://docs.microsoft.com/en-us/azure/active-directory-b2c/oauth1-technical-profile")
                    break;
                }
                case "saml": {
                    links.push(" SAML technical profile|https://docs.microsoft.com/en-us/azure/active-directory-b2c/saml-technical-profile")
                    break;
                }
                case "web.tpengine.providers.restfulprovider": {
                    links.push("RESTful technical|https://docs.microsoft.com/en-us/azure/active-directory-b2c/restful-technical-profile")
                    break;
                }
                case "web.tpengine.providers.selfassertedattributeprovider": {
                    links.push("Self-asserted technical profile|https://docs.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile")
                    break;
                }
                case "web.tpengine.sso.defaultssosessionprovider":
                case "web.tpengine.sso.externalloginssosessionprovider":
                case "web.tpengine.sso.noopssosessionprovider":
                case "web.tpengine.sso.samlssosessionprovider":
                    {
                        links.push("Single sign-on session management|https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-reference-sso-custom")
                        break;
                    }
                case "web.tpengine.providers.azureactivedirectoryprovider": {
                    links.push("Azure Active Directory technical profile|https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile")
                    break;
                }
                case "web.tpengine.providers.claimstransformationprotocolprovider": {
                    links.push("Claims transformation technical profile|https://docs.microsoft.com/en-us/azure/active-directory-b2c/claims-transformation-technical-profile")
                    break;
                }
                case "none": {
                    links.push("Technical profile for a JWT token issuer|https://docs.microsoft.com/en-us/azure/active-directory-b2c/jwt-issuer-technical-profile")
                    break;
                }
            }

            links.push("About Technical Profiles|https://docs.microsoft.com/en-us/azure/active-directory-b2c/technical-profiles-overview")
            links.push("Technical Profiles Schema reference|https://docs.microsoft.com/en-us/azure/active-directory-b2c/technicalprofiles")
        }
        else if (selectedWord.GetSelectedElement().ElementNodeName === "claimstransformation") {
            // Claims transformation help
            switch (selectedWord.GetSelectedElement().ElementType) {
                case "AndClaims".toLowerCase(): {
                    links.push("AndClaims claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/boolean-transformations#andclaims")
                    break;
                }
                case "AssertBooleanClaimIsEqualToValue".toLowerCase(): {
                    links.push("AssertBooleanClaimIsEqualToValue claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/boolean-transformations#assertbooleanclaimisequaltovalue")
                    break;
                }
                case "NotClaims".toLowerCase(): {
                    links.push("NotClaims claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/boolean-transformations#notclaims")
                    break;
                }
                case "OrClaims".toLowerCase(): {
                    links.push("OrClaims claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/boolean-transformations#orclaims")
                    break;
                }
                case "AssertDateTimeIsGreaterThan".toLowerCase(): {
                    links.push("AssertDateTimeIsGreaterThan claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/date-transformations#assertdatetimeisgreaterthan")
                    break;
                }
                case "ConvertDateToDateTimeClaim".toLowerCase(): {
                    links.push("ConvertDateToDateTimeClaim claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/date-transformations#convertdatetodatetimeclaim")
                    break;
                }
                case "GetCurrentDateTime".toLowerCase(): {
                    links.push("GetCurrentDateTime claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/date-transformations#getcurrentdatetime")
                    break;
                }
                case "DateTimeComparison".toLowerCase(): {
                    links.push(" claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/date-transformations#datetimecomparison")
                    break;
                }
                case "DoesClaimExist".toLowerCase(): {
                    links.push("DoesClaimExist claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/general-transformations#doesclaimexist")
                    break;
                }
                case "Hash".toLowerCase(): {
                    links.push("Hash claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/general-transformations#hash")
                    break;
                }
                case "ConvertNumberToStringClaim".toLowerCase(): {
                    links.push("ConvertNumberToStringClaim claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/integer-transformations#convertnumbertostringclaim")
                    break;
                }
                case "GetClaimFromJson".toLowerCase(): {
                    links.push("GetClaimFromJson claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/json-transformations#getclaimfromjson")
                    break;
                }
                case "GetClaimsFromJsonArray".toLowerCase(): {
                    links.push("GetClaimsFromJsonArray claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/json-transformations#getclaimsfromjsonarray")
                    break;
                }
                case "GetNumericClaimFromJson".toLowerCase(): {
                    links.push("GetNumericClaimFromJson claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/json-transformations#getnumericclaimfromjson")
                    break;
                }
                case "GetSingleValueFromJsonArray".toLowerCase(): {
                    links.push("GetSingleValueFromJsonArray claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/json-transformations#getsinglevaluefromjsonarray")
                    break;
                }
                case "XmlStringToJsonString".toLowerCase(): {
                    links.push("XmlStringToJsonString claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/json-transformations#xmlstringtojsonstring")
                    break;
                }
                case "CreateAlternativeSecurityId".toLowerCase(): {
                    links.push("CreateAlternativeSecurityId claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/social-transformations#createalternativesecurityid")
                    break;
                }
                case "AndClaAddItemToAlternativeSecurityIdCollectionims".toLowerCase(): {
                    links.push("AddItemToAlternativeSecurityIdCollection claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/social-transformations#additemtoalternativesecurityidcollection")
                    break;
                }
                case "GetIdentityProvidersFromAlternativeSecurityIdCollectionTransformation".toLowerCase(): {
                    links.push("GetIdentityProvidersFromAlternativeSecurityIdCollectionTransformation claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/social-transformations#getidentityprovidersfromalternativesecurityidcollectiontransformation")
                    break;
                }
                case "RemoveAlternativeSecurityIdByIdentityProvider".toLowerCase(): {
                    links.push("RemoveAlternativeSecurityIdByIdentityProvider claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/social-transformations#removealternativesecurityidbyidentityprovider")
                    break;
                }
                case "AddItemToStringCollection".toLowerCase(): {
                    links.push("AddItemToStringCollection claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/stringcollection-transformations#additemtostringcollection")
                    break;
                }
                case "AddParameterToStringCollection".toLowerCase(): {
                    links.push("AddParameterToStringCollection claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/stringcollection-transformations#addparametertostringcollection")
                    break;
                }
                case "GetSingleItemFromStringCollection".toLowerCase(): {
                    links.push("GetSingleItemFromStringCollection claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/stringcollection-transformations#getsingleitemfromstringcollection")
                    break;
                }
                case "AssertStringClaimsAreEqual".toLowerCase(): {
                    links.push("AssertStringClaimsAreEqual claims transformationhttps://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#assertstringclaimsareequal")
                    break;
                }
                case "AndClaChangeCaseims".toLowerCase(): {
                    links.push("ChangeCase claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#changecase")
                    break;
                }
                case "AndClCreateStringClaimaims".toLowerCase(): {
                    links.push("CreateStringClaim claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#createstringclaim")
                    break;
                }
                case "CompareClaims".toLowerCase(): {
                    links.push("CompareClaims claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#compareclaims")
                    break;
                }
                case "AndClaCompareClaimToValueims".toLowerCase(): {
                    links.push("CompareClaimToValue claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#compareclaimtovalue")
                    break;
                }
                case "CreateRandomString".toLowerCase(): {
                    links.push("CreateRandomStringclaims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#createrandomstring")
                    break;
                }
                case "FormatStringClaim".toLowerCase(): {
                    links.push("FormatStringClaim claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#formatstringclaim")
                    break;
                }
                case "FormatStringMultipleClaims".toLowerCase(): {
                    links.push("FormatStringMultipleClaims claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#formatstringmultipleclaims")
                    break;
                }
                case "GetMappedValueFromLocalizedCollection".toLowerCase(): {
                    links.push("GetMappedValueFromLocalizedCollection claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#getmappedvaluefromlocalizedcollection")
                    break;
                }
                case "LookupValue".toLowerCase(): {
                    links.push("LookupValue claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#lookupvalue")
                    break;
                }
                case "NullClaim".toLowerCase(): {
                    links.push("NullClaim claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#nullclaim")
                    break;
                }
                case "AndClParseDomainaims".toLowerCase(): {
                    links.push("ParseDomain claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#parsedomain")
                    break;
                }
                case "SetClaimsIfStringsAreEqual".toLowerCase(): {
                    links.push("SetClaimsIfStringsAreEqual claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#setclaimsifstringsareequal")
                    break;
                }
                case "SetClaimsIfStringsMatch".toLowerCase(): {
                    links.push("SetClaimsIfStringsMatch claims transformation|https://docs.microsoft.com/en-us/azure/active-directory-b2c/string-transformations#setclaimsifstringsmatch")
                    break;
                }
            }

            links.push("About Claims Transformations|https://docs.microsoft.com/en-us/azure/active-directory-b2c/claimstransformations")
        }

        if (links.length > 0)
            message = "Quick help\r\n\r\n";

        links.forEach(function (value) {
            message += "- [" + value.split("|")[0] + "](" + value.split("|")[1] + ")\r\n"
        });

        return message;
    }
}
