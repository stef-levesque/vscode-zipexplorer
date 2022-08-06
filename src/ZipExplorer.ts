import { 
    ExtensionContext, TextDocumentContentProvider, 
    EventEmitter, Event, InputBoxOptions,
    TreeDataProvider, TreeItem, TreeItemCollapsibleState, 
    window, workspace, Uri, commands, 
    CancellationToken, ProviderResult,
    ProgressLocation
} from 'vscode';

import * as AdmZip from 'adm-zip';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import { IZipNode, treeFromPaths} from './ZipNode';

const joinPath = require('path.join');

export class ZipRoot implements IZipNode {
    private _zip: AdmZip;
    private _tree: IZipNode;

    constructor(private _uri: Uri) {
        try {
            this._zip = new AdmZip(this._uri.fsPath);
            let files = [];
            this._zip.getEntries()
                .sort((a,b) => a.entryName.localeCompare(b.entryName))
                .forEach(e => {
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

    public extractTo(entryPath: string, targetPath) {
        this._zip.extractEntryTo(entryPath, targetPath)
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

    public extractFiles(fileUri: Uri, folderUri: Uri): void {
        const zip = new AdmZip(fileUri.fsPath);
        mkdirp.sync(folderUri.fsPath);
        zip.extractAllTo(folderUri.fsPath);
        window.showInformationMessage('Extraction done!');
    }

    public extractFilesAsync(fileUri: Uri, folderUri: Uri, index: number = 38) {
        return new Promise<void>((resolve, reject) => {
            const zip = new AdmZip(fileUri.fsPath);
            mkdirp.sync(folderUri.fsPath);
            zip.extractAllToAsync(folderUri.fsPath, false, async (error) => {
                if (error) {
                    window.showErrorMessage(error.toString());
                    reject(error);
                } else {
                    window.showInformationMessage('Extraction done!');
                    resolve();
                }
            });
        });
    }

    public extractElement(element: IZipNode, folderUri: Uri) {
        const uri = element.sourceUri;
        this._zipRoots.forEach(zip => {
            if (uri.path.startsWith(zip.sourceUri.path)) {
                const filePath = joinPath(element.parent, element.label)
                zip.extractTo(filePath, folderUri.fsPath);
            }
        });
    }

    public extractElementAsync(element: IZipNode, folderUri: Uri) {
        return new Promise<void>((resolve, reject) => {
            setTimeout( () => {
                this.extractElement(element, folderUri);
                window.showInformationMessage('Extraction done!');
                resolve();
            }, 0);
        });
    }

    public get roots() {
        return this._zipRoots;
    }

    public getContent(uri: Uri): Thenable<string> {
        return new Promise((resolve, reject) => {
            this._zipRoots.forEach(zip => {
                if (uri.fsPath.startsWith(zip.sourceUri.fsPath)) {
                    const filePath = uri.path.substr(zip.sourceUri.path.length + 1);
                    resolve(zip.getText(filePath) );
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
        this.clear();
    }

    public openZip(fileUri: Uri) {
        this.model.openZip(fileUri);
        this._onDidChangeTreeData.fire();
    }

    public clear() {
        this.model = null;
        this.model = new ZipModel();
        this._onDidChangeTreeData.fire();
    }

    public extractFiles(fileUri: Uri) {
        let folderUri = Uri.file(path.dirname(fileUri.fsPath));

        var ibo = <InputBoxOptions>{
            prompt: "Extract to",
            placeHolder: "file path",
            value: folderUri.fsPath
        }

        window.showInputBox(ibo).then(folderPath => {
            folderUri = Uri.file(folderPath);
            window.withProgress({
                location: ProgressLocation.Window,
                title: 'extracting files to ' + folderUri.fsPath
            }, () => {
                return this.model.extractFilesAsync(fileUri, folderUri);
            });
        });
    }

    public extractHere(fileUri: Uri) {
        const folderUri = Uri.file(path.dirname(fileUri.fsPath));
        window.withProgress({
            location: ProgressLocation.Window,
            title: 'extracting files to ' + folderUri.fsPath
        }, () => {
            return this.model.extractFilesAsync(fileUri, folderUri);
        });
    }

    public extractZip(element: IZipNode) {
        this.extractFiles(element.sourceUri);
    }

    public extractElement(element: IZipNode) {
        let folderUri = Uri.file(path.dirname(element.sourceUri.fsPath));

        var ibo = <InputBoxOptions>{
            prompt: "Extract to",
            placeHolder: "file path",
            value: folderUri.fsPath
        }

        window.showInputBox(ibo).then(folderPath => {
            folderUri = Uri.file(folderPath);
            window.withProgress({
                location: ProgressLocation.Window,
                title: 'extracting to ' + folderUri.fsPath
            }, () => {
                return this.model.extractElementAsync(element, folderUri);
            });
        });
    }

    public getTreeItem(element: IZipNode): TreeItem {
        const isFile = this.getType(element) === 'file';
        let command = undefined;
        if (isFile) {
            command = {
                command: 'openZipResource',
                arguments: [element.sourceUri.with({
                    scheme: 'zip',
                    path: joinPath(element.sourceUri.path, element.parent, element.label)
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
