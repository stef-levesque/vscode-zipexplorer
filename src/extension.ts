'use strict';
import {window, workspace, commands, Uri, ExtensionContext} from 'vscode';
import * as path from 'path';
import { ZipTreeDataProvider } from './ZipExplorer';

export function activate(context: ExtensionContext) {

    const zipExplorerProvider = new ZipTreeDataProvider();

    window.registerTreeDataProvider('zipExplorer', zipExplorerProvider);
    workspace.registerTextDocumentContentProvider('zip', zipExplorerProvider);

    commands.registerCommand('zipexplorer.extractFiles', (uri: Uri) => {
        zipExplorerProvider.extractFiles(uri);
    });

    commands.registerCommand('zipexplorer.extractHere', (uri: Uri) => {
        zipExplorerProvider.extractHere(uri);
    });

    commands.registerCommand('zipexplorer.exploreZipFile', (uri: Uri) => {
        zipExplorerProvider.openZip(uri);
    });

    commands.registerCommand('openZipResource', (uri: Uri) => {
        workspace.openTextDocument(uri).then(document => {
            if (document) {
                window.showTextDocument(document);
            }
        });
    });

}

export function deactivate() {
}