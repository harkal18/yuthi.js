
export abstract class Component {

    constructor(public routes: Map<string, string>) {

    }

    abstract getView(data?: any): Promise<string>;
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

    constructor(public name: string) { }

    run() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('./__yuthi_sw__.js');
                    console.info(`YUTHI: Service worker registration successful with scope: ${registration.scope}`);
                    // service worker active handler
                    try {
                        const json = await fetch('/__yuthi_api__/getServiceWorkerState')
                            .then(response => response.json());
                        if(!json.error){
                            console.info("YUTHI: Service worker is ready :)");
                            this.loadIndexPage();
                        }
                    } catch (error) {
                        console.error(error);
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

    private loadIndexPage() {
        fetch('/__yuthi_api__/getIndexPage')
            .then(response => response.text())
            .then(html => {
                document.open();
                document.write(html);
                document.close();
            }).catch(error => {
                console.error(`YUTHI: Something went wrong :( ${error}`);
            });
    }

}