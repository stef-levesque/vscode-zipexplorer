import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { IZipNode, treeFromPaths} from './ZipNode'

export class ZipRoot implements IZipNode {
    private _zip: AdmZip;
    private _tree: IZipNode;

    constructor(private _uri: Uri) {
        try {
            this._zip = new AdmZip(this._uri.fsPath);
            let files = [];
            this._zip.getEntries().forEach(e => {
                files.push(e.entryName);
            });
            this._tree = treeFromPaths(files, _uri, 
                path.basename(this._uri.fsPath))
        } catch (e) {
            window.showErrorMessage(e.toString());
        }
    }

    public getText(filePath: string): Thenable<string> {
        return new Promise((resolve, reject) => {
            try {
                this._zip.readAsTextAsync(filePath, resolve);
            } catch (error) {
                reject(error.toString())
            }
        });
    }

    public get sourceUri(): Uri {
        return this._uri;
    }
    public get label(): string {
        return this._tree.label;
    }

    public get parent(): string {
        return this._tree.parent;
    }

    public get nodes() {
        return this._tree.nodes;
    }
}


export class ZipModel {
    private _zipRoots: ZipRoot[];

    constructor() {
        this._zipRoots = [];
    }

    public openZip(fileUri: Uri) {
        this._zipRoots.push(new ZipRoot(fileUri));
    }

    public get roots() {
        return this._zipRoots;
    }

    public getContent(uri: Uri): Thenable<string> {
        return new Promise((resolve, reject) => {
            this._zipRoots.forEach(element => {
                if (uri.fsPath.startsWith(element.sourceUri.fsPath)) {
                    const filePath = uri.fsPath.substr(element.sourceUri.fsPath.length + 1);
                    resolve( element.getText(filePath) );
                }
            });
        });
    }
}

export class ZipTreeDataProvider implements TreeDataProvider<IZipNode>, TextDocumentContentProvider {
    private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
    readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

    private model: ZipModel;

    constructor() {
        this.model = new ZipModel();
    }

    public openZip(fileUri: Uri) {
        this.model.openZip(fileUri);
        this._onDidChangeTreeData.fire();
    }


    public getTreeItem(element: IZipNode): TreeItem {
        const isFile = this.getType(element) === 'file';
        let command = undefined;
        if (isFile) {
            command = {
                command: 'openZipResource',
                arguments: [element.sourceUri.with({
                    scheme: 'zip',
                    path: path.join(element.sourceUri.path, element.parent, element.label)
                })],
                title: 'Open Zip Resource'
            }
        }
        return {
            label: element.label,
            collapsibleState: isFile ? void 0 : TreeItemCollapsibleState.Collapsed,
            command: command,
            iconPath: this.getIcon(element),
            contextValue: this.getType(element)
        }
    }

    private getIcon(element: IZipNode) {
        const type = this.getType(element);

        return {
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', type + '.svg'),
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', type + '.svg')
        }
    }

    private getType(element: IZipNode): string {
        if (element.parent === null) {
            return 'zip';
        } else if (element.label.endsWith('/')) {
            return 'folder';
        } else {
            return 'file';
        }
    }

    public getChildren(element?: IZipNode): IZipNode[] {
        if (!element) {
            return this.model.roots;
        }
        return element.nodes;
    }

    public provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
        return this.model.getContent(uri);
    }
}
