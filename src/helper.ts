import { IEntityType, ISimpleType } from './outtypes';
import * as xml2js from 'xml2js';
import * as request from 'request';

export type Modularity = "Ambient" | "Modular";

export interface GeneratorSettings {
    source: string,
    modularity: Modularity,
    requestOptions: request.CoreOptions
}

export interface TemplateGeneratorSettings extends GeneratorSettings {
    useTemplate: string;
}

export class NoHeaderError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

export function createHeader(options: GeneratorSettings): string {
    // Create update information
    const headerobject = JSON.stringify(options, null, '\t');
    let header = `/**************************************************************************
Created by odatatools: https://marketplace.visualstudio.com/items?itemName=apazureck.odatatools\n`;
    header += "Use Command 'odata: xyUpdate to refresh data while this file is active in the editor.\n"
    header += "Creation Time: " + Date() + "\n";
    header += "DO NOT DELETE THIS IN ORDER TO UPDATE YOUR SERVICE\n";
    header += "#ODATATOOLSOPTIONS\n"
    header += headerobject + "\n";
    header += "#ODATATOOLSOPTIONSEND\n";
    return header + "**************************************************************************/\n\n"
}

export function getGeneratorSettingsFromDocumentText(input: string): TemplateGeneratorSettings {
    const header = input.match(/#ODATATOOLSOPTIONS([\s\S]*)#ODATATOOLSOPTIONSEND/m);
    if (!header)
        throw new NoHeaderError("No valid odata tools header found.");
    return JSON.parse(header[1]);
}

export async function getMetadata(maddr: string, options?: request.CoreOptions): Promise<Edmx> {
    return new Promise<Edmx>((resolve, reject) => {
        let rData = '';
        request.get(maddr, options)
            .on('data', (data) => {
                rData += data;
            })
            .on('complete', (resp) => {
                xml2js.parseString(rData, (err, data) => {
                    try {
                        if (!data["edmx:Edmx"]) {
                            return reject('Response is not valid oData metadata. See output for more information');
                        }
                        if (data["edmx:Edmx"])
                            return resolve(data["edmx:Edmx"]);
                        return reject("Not valid metadata")
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            })
            .on('error', (resp) => {
                return 0;
            });
    });
}

// @ts-ignore
export async function GetOutputStyleFromUser(): Promise<Modularity> {
    // log.TraceEnterFunction();
//     return await window.showQuickPick(["Modular", "Ambient"], {
//         placeHolder: "Select to generate the service as a modular or ambient version."
//     }) as Modularity;
// }
}

export function getChildParentType (type: string) {
    const typestringSplit = type.split('.');
    if (typestringSplit.length > 2) {
        const childType = typestringSplit[typestringSplit.length -1];
        typestringSplit.pop();
        const parentType = typestringSplit.join('');
        type = `${parentType}.${childType}`;
    }

    return type;
}

export function getType(typestring: string): ISimpleType {
    let m = typestring.match(/Collection\((.*)\)/);

    if (m) {
        return {
            IsCollection: true,
            Name: getChildParentType(m[1]),
            IsVoid: m[1] === "void",
            Type: m[1]
        }
    }

    // const typestringSplit = typestring.split('.');
    // if (typestringSplit.length > 2) {
    //     const childType = typestringSplit[typestringSplit.length -1];
    //     typestringSplit.pop();
    //     const parentType = typestringSplit.join('');
    //     typestring = `${parentType}.${childType}`;
    // }

    return {
        // get last item after the dot. Join everything before so it's a module... 
        Name: getChildParentType(typestring),
        IsCollection: false,
        IsVoid: typestring === "void",
        Type: typestring
    }
}

export async function getHostAddressFromUser(): Promise<string> {
    let pick: string = "New Entry...";
    // const rul = Global.recentlyUsedAddresses
    // if (rul && rul.length > 0) {}
        // pick = await window.showQuickPick(["New Entry..."].concat(Global.recentlyUsedAddresses), {
        //     placeHolder: "Select from recently used addresses or add new entry"
        // });
    if (pick === "New Entry...") {}
        // pick = await window.showInputBox({
        //     placeHolder: "http://my.odata.service/service.svc",
        //     value: Global.recentlyUsedAddresses.pop(),
        //     prompt: "Please enter uri of your oData service.",
        //     ignoreFocusOut: true,
        // });

    if (!pick)
        throw new Error("User did not input valid address");

    pick = pick.replace("$metadata", "");
    if (pick.endsWith("/"))
        pick = pick.substr(0, pick.length - 1);

    return pick + "/$metadata";
}

export function getEntityTypeInterface(type: EntityType, schema: Schema): IEntityType {
    const p: Partial<IEntityType> = {
        // Key: type.Key ? type.Key[0].PropertyRef[0].$.Name : undefined,
        Name: type.$.Name,
        Fullname: schema.$.Namespace + "." + type.$.Name,
        Properties: [],
        NavigationProperties: [],
        BaseTypeFullName: type.$.BaseType || undefined,
        BaseTypeNamespace: getBaseTypeNamespace(type.$.BaseType),
        OpenType: type.$.OpenType || false,
        Actions: [],
        Functions: [],
    };
    if (type.Property)
        for (let prop of type.Property)
            p.Properties.push({
                Name: prop.$.Name,
                Type: getType(prop.$.Type),
                Nullable: prop.$.Nullable ? (prop.$.Nullable == "false" ? false : true) : true,
            });
    if (type.Key) {
        const keyName = type.Key[0].PropertyRef[0].$.Name;
        p.Key = p.Properties.find(t => t.Name == keyName);
    }
    if (type.NavigationProperty)
        for (const prop of type.NavigationProperty) {
            let navprop = prop as Property;
            p.NavigationProperties.push({
                Name: navprop.$.Name,
                Type: getType(navprop.$.Type),
                Nullable: true,
            });
        }
    return p as IEntityType;
}

export function getBaseTypeNamespace(baseType: string): string | null {
    if (!baseType) {
        return null;
    }
    const arr = baseType.split('.');
    const len = arr.length;
    return arr.filter((_, i) => i < len - 1).join('') + '.' + arr[len - 1];
}