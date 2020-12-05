
const ACTION_LOAD_COMPONENT = "ACTION_LOAD_COMPONENT";
const ACTION_UPDATE_COMPONENT = "ACTION_UPDATE_COMPONENT";
const ACTION_WINDOW_EVENT = "ACTION_WINDOW_EVENT";

export abstract class Component {

    constructor(public routes: Map<string, string>) {

    }

    abstract getView(data?: any): Promise<string>;
}

class Requestable {
    id!: string;
    api!: string;
    error?: boolean;
    message?: string;
    data?: any;
}

export class App {

    constructor(
        public name: string,
        public components: Map<string, Component>,
        public routes: Map<string, string>
    ) { }

    private resolveComponents(code: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                let html = "";
                const parser = new DOMParser();
                const doc: any = parser.parseFromString(code, "text/xml");
                for (const child of doc.children) {
                    const component: Component | undefined = this.components.get(child.tagName.toLowerCase());
                    if (component !== undefined) {
                        const view = await component.getView(child.getAttribute("data"));
                        html += view;
                    } else {
                        if (child.childElementCount > 0) {
                            const components = this.resolveComponents(child.outerHTML);
                            html += components;
                        } else {
                            html += child.outerHTML;
                        }
                    }
                }
                resolve(html)
            } catch (error) {
                reject(error);
            }
        });
    }

    run() {
        // here we should set up window message listener
        // and send the ping to load the main component
        (async () => {
            try {
                const rootComponent = this.components.get('root');
                if (rootComponent !== undefined) {
                    const rootView = await rootComponent.getView();
                    const html = await this.resolveComponents(rootView);
                    document.open();
                    document.write(html);
                    document.close();
                } else {
                    throw new Error("Root Component not defined in the components");
                }
            } catch (error) {
                console.log(error);
            }
        })();
    }

    navigate(path: string) {

    }

}

export class YuthiApp {

    constructor(public name: string) {
        window.onmessage = (event: any) => {
            console.log(event);
            (async () => {
                try {
                    const requestable: Requestable = JSON.parse(event.data);
                    if (
                        requestable.id !== undefined &&
                        requestable.id !== null &&
                        requestable.api !== undefined &&
                        requestable.api !== null
                    ) {
                        switch (requestable.api) {
                            case ACTION_UPDATE_COMPONENT:

                                break;
                        }
                    }
                } catch (error) { }
            })();
        };
    }

    private checkServiceWorkerState(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                const json = await fetch('/__yuthi_api__/getServiceWorkerState').then(response => response.json());
                resolve(!json.error);
            } catch (error) {
                console.error(error);
                console.error("YUTHI: Service worker is not ready :( Refreshing the page...");
                resolve(false);

            }
        });
    }

    private simplifyEvent(event: any, depth = 5, max_depth = 5) {
        if (depth > max_depth) {
            return 'Object';
        } else {
            const object: any = {};
            for (let key in event) {
                let value = event[key];
                if (value instanceof Node) {
                    const node: any = value;
                    value = {
                        id: node.id,
                        hash: node.getAttribute("__hash__") || null
                    };
                } else if (value instanceof Window) {
                    value = 'Window';
                } else if (value instanceof Object) {
                    value = this.simplifyEvent(value, depth + 1, max_depth);
                }
                object[key] = value;
            }
            return depth ? object : JSON.stringify(object);
        }
    }

    run() {
        if (navigator.serviceWorker) {
            window.addEventListener('load', async () => {
                try {
                    await navigator.serviceWorker.register('./__yuthi_sw__.js');
                    const registration: any = await navigator.serviceWorker.ready;
                    const ready = await this.checkServiceWorkerState();
                    if (ready) {
                        const events = ['click'];
                        Object.keys(window).forEach(key => {
                            if (/^on/.test(key)) {
                                if(events.includes(key.slice(2))){
                                    window.addEventListener(key.slice(2), (event: any) => {
                                        const requestable: Requestable = {
                                            id: "window_event_request",
                                            api: ACTION_WINDOW_EVENT,
                                            data: {
                                                event: this.simplifyEvent(event)
                                            }
                                        }
                                        registration.active.postMessage(JSON.stringify(requestable));
                                    });
                                }
                            }
                        });
                        navigator.serviceWorker.addEventListener('message', event => {
                            try {
                                const requestable: Requestable = JSON.parse(event.data);
                                if (
                                    requestable.id !== undefined &&
                                    requestable.id !== null &&
                                    requestable.api !== undefined &&
                                    requestable.api !== null
                                ) {
                                    switch (requestable.api) {
                                        case ACTION_UPDATE_COMPONENT:
                                            document.body.append(new DOMParser().parseFromString(requestable.data.html, "text/xml").documentElement)
                                            break;
                                    }
                                }
                            } catch (error) { }
                        });

                        const requestable: Requestable = {
                            id: "load_root_component_request",
                            api: ACTION_LOAD_COMPONENT,
                            data: {
                                component: "root"
                            }
                        }
                        registration.active.postMessage(JSON.stringify(requestable));
                    } else {
                        console.error("YUTHI: Service worker is not ready :( Refreshing the page...");
                        window.location.reload();
                    }
                } catch (error) {
                    console.error("YUTHI: Service worker registration failed :(", error);
                }
            });
        } else {
            console.error("YUTHI: This browser do not support service workers :( Yuthi.js can't work in such a browser");
        }
    }

}