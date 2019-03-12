import Consts from "../Consts";
import { Suggestion } from "../models/Suggestion";
import xmldom = require('xmldom')
import { IefSchema } from "../models/IefSchema";
const DOMParser = require('xmldom').DOMParser;

export default class XsdHelper {

    static staticXsdDod = null;
    static staticIefSchema: Array<IefSchema>;

    static GetXpahElement(xpath, xsdDoc, parentElemnt, parentElemntName: string, parentElemntType: string, iefSchema, select) {
        let element: IefSchema = new IefSchema();

        if (parentElemntName === 'BuildingBlocks') {
            console.log('BuildingBlocks');
        }

        //
        if (parentElemnt === undefined) {
            console.log("Return");
            return;
        }

        // Get the element path
        element.Type = 'e';
        element.Name = parentElemntName;
        element.parentXpath = xpath;
        element.xpath = xpath + '/' + element.Name;

        // Check whether element has content
        element.HasContent = (parentElemntType.startsWith('xs:') || parentElemnt.nodeName === 'xs:simpleType');

        // Get the element description
        let documentation = select("./xs:annotation/xs:documentation", parentElemnt);
        if (documentation.length > 0) {
            element.Description = documentation[0].textContent.replace(/\s{2,}/g, '');
        }

        // Get attributes
        var attributes
        if (parentElemnt.nodeName === 'xs:element')
            attributes = select("./xs:complexType/xs:attribute", parentElemnt);
        else
            attributes = select("./xs:attribute|./xs:simpleContent/xs:extension/xs:attribute", parentElemnt);

        for (var i = 0; i < attributes.length; i++) {
            let attribute: IefSchema = new IefSchema();
            attribute.Type = 'a';
            attribute.Name = attributes[i].getAttribute("name");
            attribute.parentXpath = element.xpath;
            attribute.xpath = element.xpath + '/' + attribute.Name;
            iefSchema.push(attribute);

            // Get attribute restrictions
            if (attributes[i].getAttribute("type").startsWith("tfp:")) {
                var restrictions = select("//xs:schema/xs:simpleType[@name='" + attributes[i].getAttribute("type").substring(4) + "']/xs:restriction/xs:enumeration", xsdDoc);
                for (var r = 0; r < restrictions.length; r++) {
                    let attribute: IefSchema = new IefSchema();
                    attribute.Type = 'av';
                    attribute.Name = restrictions[r].getAttribute("value");
                    attribute.parentXpath = element.xpath;
                    attribute.xpath = element.xpath + '/' + attribute.Name;

                    let documentation = select("./xs:annotation/xs:documentation", restrictions[r]);
                    if (documentation.length > 0) {
                        element.Description = documentation[0].textContent.replace(/\s{2,}/g, '');
                    }
                    iefSchema.push(attribute);
                }
            }
            else if(attributes[i].getAttribute("type") === 'xs:boolean')
            {
                let attribute1: IefSchema = new IefSchema();
                attribute1.Type = 'av';
                attribute1.Name = 'false';
                attribute1.parentXpath = element.xpath;
                attribute1.xpath = element.xpath + '/' + attribute.Name;
                iefSchema.push(attribute1);

                let attribute2: IefSchema = new IefSchema();
                attribute2.Type = 'av';
                attribute2.Name = 'true';
                attribute2.parentXpath = element.xpath;
                attribute2.xpath = element.xpath + '/' + attribute.Name;
                iefSchema.push(attribute2);
            }

        }

        // Get attribute restrictions
        if (parentElemnt.nodeName === 'xs:simpleType') {
            var restrictions = select("./xs:restriction/xs:enumeration", parentElemnt);
            for (var i = 0; i < restrictions.length; i++) {
                let attribute: IefSchema = new IefSchema();
                attribute.Type = 'av';
                attribute.Name = restrictions[i].getAttribute("value");
                attribute.parentXpath = element.xpath;
                attribute.xpath = element.xpath + '/' + attribute.Name;

                let documentation = select("./xs:annotation/xs:documentation", restrictions[i]);
                if (documentation.length > 0) {
                    element.Description = documentation[0].textContent.replace(/\s{2,}/g, '');
                }
                iefSchema.push(attribute);
            }
        }
        // Get parent element's children
        var children
        if (parentElemnt.nodeName === 'xs:element')
            children = select("./xs:complexType/xs:sequence/xs:element|./xs:complexType/xs:choice/xs:element", parentElemnt);
        else
            children = select("./xs:sequence/xs:element|./xs:choice/xs:element", parentElemnt);

        for (var i = 0; i < children.length; i++) {

            if (children[i].getAttribute("type").startsWith("tfp:")) {

                // Get the complex type
                var realElement = select("//xs:schema/xs:complexType[@name='" + children[i].getAttribute("type").substring(4) + "']", xsdDoc);
                if (realElement.length > 0)
                    XsdHelper.GetXpahElement(element.xpath, xsdDoc, realElement[0], children[i].getAttribute("name"), children[i].getAttribute("type"), iefSchema, select)
                else {
                    // If not found get the simple type
                    realElement = select("//xs:schema/xs:simpleType[@name='" + children[i].getAttribute("type").substring(4) + "']", xsdDoc);
                    if (realElement.length > 0)
                        XsdHelper.GetXpahElement(element.xpath, xsdDoc, realElement[0], children[i].getAttribute("name"), children[i].getAttribute("type"), iefSchema, select)
                }
            }
            else {
                XsdHelper.GetXpahElement(element.xpath, xsdDoc, children[i], children[i].getAttribute("name"), children[i].getAttribute("type"), iefSchema, select)
            }
        }

        iefSchema.push(element);

        return null;
    }

    static GetSubElements(xPathArray: string[]): Suggestion[] | any {

        if ((!xPathArray) || xPathArray.length == 0) {
            return;
        }

        let xPathString = '';
        for (let i = 0; i < xPathArray.length; i++) {
            xPathString += '/' + xPathArray[i];
        }

        let suggestions: Suggestion[] = [];
        let IefSchema: Array<IefSchema> = XsdHelper.getIefSchema();
        let selectedElements = IefSchema.filter((iefSchema: IefSchema) => iefSchema.Type === 'e' && iefSchema.parentXpath === xPathString)
        for (var i = 0; i < selectedElements.length; i++) {
            let suggestion: Suggestion = new Suggestion();
            suggestion.InsertText = selectedElements[i].Name;
            suggestion.Help = selectedElements[i].Description;
            suggestion.HasChildren = (IefSchema.filter((iefSchema: IefSchema) => iefSchema.Type === 'e' && iefSchema.parentXpath === selectedElements[i].xpath).length > 0);
            suggestion.HasContent = selectedElements[i].HasContent;
            suggestions.push(suggestion)
        }
        return suggestions;
    }


    static GetAttributes(xPathArray: string[]): Suggestion[] | any {

        if ((!xPathArray) || xPathArray.length == 0) {
            return;
        }

        let xPathString = '';
        for (let i = 0; i < xPathArray.length; i++) {
            xPathString += '/' + xPathArray[i];
        }

        let suggestions: Suggestion[] = [];
        let IefSchema: Array<IefSchema> = XsdHelper.getIefSchema();
        let selectedElements = IefSchema.filter((iefSchema: IefSchema) => iefSchema.Type === 'a' && iefSchema.parentXpath === xPathString)
        for (var i = 0; i < selectedElements.length; i++) {
            let suggestion: Suggestion = new Suggestion();
            suggestion.InsertText = selectedElements[i].Name;
            suggestion.Help = selectedElements[i].Description;
            suggestions.push(suggestion)
        }
        return suggestions;
    }


    public static GetAttributeValues(xPathArray: string[], attributeName: string): Suggestion[] | any {

        if ((!xPathArray) || xPathArray.length == 0) {
            return;
        }

        let xPathString = '';
        for (let i = 0; i < xPathArray.length; i++) {
            xPathString += '/' + xPathArray[i];
        }

        let suggestions: Suggestion[] = [];
        let IefSchema: Array<IefSchema> = XsdHelper.getIefSchema();
        let selectedElements = IefSchema.filter((iefSchema: IefSchema) => iefSchema.Type === 'av' && iefSchema.parentXpath === xPathString)
        for (var i = 0; i < selectedElements.length; i++) {
            let suggestion: Suggestion = new Suggestion();
            suggestion.InsertText = selectedElements[i].Name;
            suggestion.Help = selectedElements[i].Description;
            suggestions.push(suggestion)
        }
        return suggestions;
    }


    public static getXsdDocument(): xmldom.Document {

        if (!XsdHelper.staticXsdDod) {
            var c = new DOMParser().parseFromString(Consts.IEF_Schema);
            XsdHelper.staticXsdDod = c
        }

        return XsdHelper.staticXsdDod;
    }

    public static getIefSchema(): Array<IefSchema> {

        if ((!XsdHelper.staticIefSchema) || XsdHelper.staticIefSchema.length == 0) {
            // Load the XML file    
            var xsdDoc = XsdHelper.getXsdDocument();

            let xpath = require('xpath')
            let select = xpath.useNamespaces({ "xs": "http://www.w3.org/2001/XMLSchema" });

            let TrustFrameworkPolicy = select("//xs:schema/xs:element[@name='TrustFrameworkPolicy']", xsdDoc)[0];

            XsdHelper.staticIefSchema = new Array<IefSchema>();
            XsdHelper.GetXpahElement('',
                xsdDoc, TrustFrameworkPolicy,
                TrustFrameworkPolicy.getAttribute("name"),
                TrustFrameworkPolicy.getAttribute("type"),
                XsdHelper.staticIefSchema,
                select);
        }

        return XsdHelper.staticIefSchema;
    }
}