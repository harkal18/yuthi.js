import { DOMParser } from 'xmldom';


class YuthiAppConfig {
    name?: string;
    components?: Map<string, string>;
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

const resolveComponents = (components: Map<string, string>, code: string): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            let html = "";
            const parser = new DOMParser();
            const document: any = parser.parseFromString(code, "text/xml");
            for (const child of Array.from(document.childNodes) as any) {

                const component: any = components.get(child.nodeName.toLowerCase());
                if (component !== undefined) {
                    const view = await fetch(component)
                        .then(res => res.text())
                        .then(javascript => {
                            const component = new Function(`
                                                    ${javascript}
                                                    component.apply(component, arguments);
                                                    return component;
                                                `)();
                            return component.getView(child.getAttribute("data"));
                        });
                    html += view;
                } else {
                    if (child.hasChildNodes() && child.childNodes.length > 0) {
                        const _components = await resolveComponents(components, child.toString());
                        html += _components;
                    } else {
                        html += child.toString();
                    }
                }
            }
            resolve(html)
        } catch (error) {
            reject(error);
        }
    });
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
                    } else if (api === "getIndexPage") {
                        fetch("./yuthi.app.json")
                            .then(res => res.json())
                            .then((json: YuthiAppConfig) => {
                                console.log(json);
                                if (json !== undefined && json.components !== undefined) {
                                    const components = mapFromObject(json.components);
                                    const root: any = components.get("root");
                                    fetch(root)
                                        .then(res => res.text())
                                        .then(async javascript => {
                                            const component = new Function(`
                                                    ${javascript}
                                                    component.apply(component, arguments);
                                                    return component;
                                                `)();
                                            context.__xml_parser__ = DOMParser;
                                            const html = await resolveComponents(components, component.getView());
                                            resolve(new Response(html, {
                                                status: 200,
                                                headers: {
                                                    'content-type': 'text/html'
                                                }
                                            }));
                                        }).catch(error => {
                                            resolve(new Response(`${error}`, {
                                                status: 200,
                                                headers: {
                                                    'content-type': 'text/html'
                                                }
                                            }));
                                        });
                                } else {
                                    const result = {
                                        "error": true,
                                        "message": "Invalid yuthi.app.json file :( Can't load root component.",
                                        "data": {}
                                    }
                                    resolve(new Response(JSON.stringify(result), {
                                        status: 200,
                                        headers: {
                                            'content-type': 'application/json'
                                        }
                                    }));
                                }
                            }).catch(error => {
                                console.log("error getting config file: " + error)
                                const result = {
                                    "error": true,
                                    "message": `${error}`,
                                    "data": {}
                                }
                                resolve(new Response(JSON.stringify(result), {
                                    status: 200,
                                    headers: {
                                        'content-type': 'application/json'
                                    }
                                }));
                            });
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
})();
