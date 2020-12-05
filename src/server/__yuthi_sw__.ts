import { DOMParser } from 'xmldom';

const ACTION_LOAD_COMPONENT = "ACTION_LOAD_COMPONENT";
const ACTION_UPDATE_COMPONENT = "ACTION_UPDATE_COMPONENT";
const ACTION_WINDOW_EVENT = "ACTION_WINDOW_EVENT";

export const generateRandomString = (length: number): string => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

class Requestable {
    id!: string;
    api!: string;
    error?: boolean;
    message?: string;
    data?: any;
}

class YuthiAppConfig {
    name?: string;
    components?: Map<string, string>;
}

type OnComponentChange = (html: string) => void;

class Component {

    private hash: string;
    private html: string = '';

    constructor(public components: Map<string, string>, public onComponentChange: OnComponentChange, public data?: string) {
        this.hash = generateRandomString(7);
    }

    private resolveComponent(dom: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(dom);
                let tempHtml = "";
                const parser = new DOMParser();

                let sw: any = self;
                sw.__xml_parser__ = DOMParser;

                const document: any = parser.parseFromString(dom, "text/xml");
                document.documentElement.setAttribute("__hash__", this.hash);
                for (const child of Array.from(document.childNodes) as any) {
                    const component: any = this.components.get(child.nodeName.toLowerCase());
                    if (component !== undefined) {
                        const view = await new Promise(async (resolve2, reject2) => {
                            try {
                                await fetch(component)
                                    .then(res => res.text())
                                    .then(javascript => {
                                        const component = new Function(`
                                        ${javascript}
                                        return component;
                                    `)();
                                        component(new App(new Component(this.components, (html: string) => {
                                            resolve2(html);
                                        }, child.getAttribute("data"))));
                                    })
                            } catch (error) {
                                reject2(error);
                            }
                        });
                        tempHtml += view;
                    } else {
                        if (child.hasChildNodes() && child.childNodes.length > 1) {
                            const _components = await this.resolveComponent(child.toString());
                            tempHtml += _components;
                        } else {
                            tempHtml += child.toString();
                        }
                    }
                }
                resolve(tempHtml);
            } catch (error) {
                reject(error);
            }
        });
    }

    getData() {
        return this.data;
    }

    setDom(dom: string) {
        this.resolveComponent(dom).then((html: string) => {
            this.html = html;
            if (this.onComponentChange !== undefined) {
                this.onComponentChange(this.html);
            }
        })
            .catch(error => console.log(error));
    }

    private getDom(): string {
        return this.html;
    }

}

class App {

    constructor(public component: Component) {

    }

}

const mapFromObject = (object: any): Map<string, any> => {
    const map: Map<string, any> = new Map();
    if (object !== undefined) {
        for (const key in object) {
            if (object.hasOwnProperty(key)) {
                map.set(key, object[key]);
            };
        }
    }
    return map;
}

const objectFromMap = (map: any): any => {
    const object: any = {};
    map.forEach((value: any, key: string) => {
        object[key] = value;
    });
    return object;
}

(() => {
    const context: ServiceWorkerGlobalScope | any = self;

    context.addEventListener('fetch', (event: any) => {
        const url = event.request.url;
        if (url.startsWith(`${context.registration.scope}__yuthi_api__/`)) {
            event.respondWith(new Promise((resolve, reject) => {
                try {
                    const url = event.request.url;
                    const justUrl = url.split("?")[0];
                    const paths = justUrl.split("/");
                    var total = paths.length;
                    var api = paths[total - 1];
                    if (api === "getServiceWorkerState") {
                        const result = {
                            "error": false,
                            "message": "Service worker is enabled :)",
                            "data": {}
                        }
                        resolve(new Response(JSON.stringify(result), {
                            status: 200,
                            headers: {
                                'content-type': 'application/json'
                            }
                        }));
                    } else {
                        const result = {
                            "error": true,
                            "message": "Unknown action",
                            "data": {}
                        }
                        resolve(new Response(JSON.stringify(result), {
                            status: 200,
                            headers: {
                                'content-type': 'application/json'
                            }
                        }));
                    }
                } catch (error) {
                    reject(error);
                }
            }));
        } else if (url.startsWith(`${context.registration.scope}__yuthi_server__/serveFile`)) {

        }
    });

    context.addEventListener('message', async (event: any) => {
        try {
            const requestable: Requestable = JSON.parse(event.data);
            if (
                requestable.id !== undefined &&
                requestable.id !== null &&
                requestable.api !== undefined &&
                requestable.api !== null
            ) {
                switch (requestable.api) {
                    case ACTION_LOAD_COMPONENT:
                        const json: YuthiAppConfig = await fetch("./yuthi.app.json").then(res => res.json());
                        console.log(json);
                        const components = mapFromObject(json.components);
                        const root: any = components.get(requestable.data.component);
                        const javascript = await fetch(root).then(res => res.text());
                        const component = new Function(`
                            ${javascript}
                            return component;
                        `)();
                        component(new App(new Component(components, (html: string) => {
                            const loadIndexPageRequestable: Requestable = {
                                id: "update_component_request",
                                api: ACTION_UPDATE_COMPONENT,
                                data: {
                                    html: html
                                }
                            }
                            event.source.postMessage(JSON.stringify(loadIndexPageRequestable));
                        })));
                        break;
                    case ACTION_WINDOW_EVENT:
                        console.log(requestable.data);
                        break;
                }
            }
        } catch (error) { }
    });

})();
