'use strict';
import * as vscode from 'vscode';
import { ZipTreeDataProvider } from './ZipExplorer';

export function activate(context: vscode.ExtensionContext) {

    const zipExplorerProvider = new ZipTreeDataProvider();

    vscode.window.registerTreeDataProvider('zipExplorer', zipExplorerProvider);
    vscode.workspace.registerTextDocumentContentProvider('zip', zipExplorerProvider);

    vscode.commands.registerCommand('zipexplorer.exploreZipFile', (uri: vscode.Uri) => {
        zipExplorerProvider.openZip(uri);
    });

    vscode.commands.registerCommand('openZipResource', (uri: vscode.Uri) => {
        vscode.workspace.openTextDocument(uri).then(document => {
            if (document) {
                vscode.window.showTextDocument(document);
            }
        });
    });

}

export function deactivate() {
}