const vscode = require('vscode');

function activate(context) {
    const formatter = vscode.languages.registerDocumentFormattingEditProvider( [
        'mapserver',
        'symbolset'
    ], {
        provideDocumentFormattingEdits(document) {
            const edits = [];
            let indentLevel = 0;
            const language = document.languageId;
            
            const tabSize = vscode.workspace.getConfiguration('editor', document.uri).get('tabSize', 2);
            const insertSpaces = vscode.workspace.getConfiguration('editor', document.uri).get('insertSpaces', true);
            const indentChar = insertSpaces ? ' ' : '\t';
            const indentString = insertSpaces ? indentChar.repeat(tabSize) : indentChar;

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const text = line.text.trim();

                if (/^END\b/i.test(text)) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }

                if (text.length > 0) {
                    const indentation = indentString.repeat(indentLevel);
                    const formattedText = indentation + text;

                    if (formattedText !== line.text) {
                        edits.push(vscode.TextEdit.replace(line.range, formattedText));
                    }
                }

                if (language === 'symbolset') {
                    if (/^(SYMBOL)\b/i.test(text) &&
                        !/(^|\s)END(\s|$)/i.test(text)) {
                        indentLevel++;
                    }
                }else if (language === 'mapserver') {
                    if (/^(CLASS|CLUSTER|COMPOSITE|CONNECTIONOPTIONS|FEATURE|GRID|JOIN|LABEL|LAYER|LEADER|LEGEND|MAP|METADATA|OUTPUTFORMAT|PATTERN|POINTS|PROJECTION|QUERYMAP|REFERENCE|SCALEBAR|SCALETOKEN|STYLE|VALIDATION|WEB)\b/i.test(text) &&
                        !/(^|\s)END(\s|$)/i.test(text)) {
                        indentLevel++;
                    }
                }

                
            }

            return edits;
        }
    });
    const colorProvider = vscode.languages.registerColorProvider( [
        'mapserver',
        'symbolset'
    ], {
        provideDocumentColors(document) {
            const colors = [];
            
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const text = line.text;
                
                const rgbPatterns = [
                    { pattern: /\bCOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "COLOR" },
                    { pattern: /\bOUTLINECOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "OUTLINECOLOR" },
                    { pattern: /\bBACKGROUNDCOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "BACKGROUNDCOLOR" },
                    { pattern: /\bSHADOWCOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "SHADOWCOLOR" }
                ];
                
                for (const { pattern, prefix } of rgbPatterns) {
                    let match;
                    let searchText = text;
                    let offset = 0;
                    
                    while ((match = pattern.exec(searchText)) !== null) {
                        const startPos = new vscode.Position(i, offset + match.index);
                        const endPos = new vscode.Position(i, offset + match.index + match[0].length);
                        const range = new vscode.Range(startPos, endPos);
                        
                        const r = parseInt(match[1], 10) / 255;
                        const g = parseInt(match[2], 10) / 255;
                        const b = parseInt(match[3], 10) / 255;
                        
                        colors.push(new vscode.ColorInformation(
                            range,
                            new vscode.Color(r, g, b, 1)
                        ));
                        
                        offset += match.index + match[0].length;
                        searchText = text.substring(offset);
                    }
                }
                
                const hexPatterns = [
                    /'#([0-9A-Fa-f]{6})'/,
                    /"#([0-9A-Fa-f]{6})"/
                ];
                
                for (const pattern of hexPatterns) {
                    let match;
                    let searchText = text;
                    let offset = 0;
                    
                    while ((match = pattern.exec(searchText)) !== null) {
                        const hexColor = match[1];
                        const startPos = new vscode.Position(i, offset + match.index + match[0].indexOf('#'));
                        const endPos = new vscode.Position(i, startPos.character + hexColor.length + 1);
                        const range = new vscode.Range(startPos, endPos);
                        
                        const r = parseInt(hexColor.substr(0, 2), 16) / 255;
                        const g = parseInt(hexColor.substr(2, 2), 16) / 255;
                        const b = parseInt(hexColor.substr(4, 2), 16) / 255;
                        
                        colors.push(new vscode.ColorInformation(
                            range,
                            new vscode.Color(r, g, b, 1)
                        ));
                        offset += match.index + match[0].length;
                        searchText = text.substring(offset);
                    }
                }
            }
            
            return colors;
        },
        
        provideColorPresentations(color, context) {
            const originalText = context.document.getText(context.range);
            
            const r = Math.round(color.red * 255);
            const g = Math.round(color.green * 255);
            const b = Math.round(color.blue * 255);
            
            if (/\bCOLOR\s+\d+\s+\d+\s+\d+/.test(originalText)) {
                return [new vscode.ColorPresentation(`COLOR ${r} ${g} ${b}`)];
            } else if (/\bOUTLINECOLOR\s+\d+\s+\d+\s+\d+/.test(originalText)) {
                return [new vscode.ColorPresentation(`OUTLINECOLOR ${r} ${g} ${b}`)];
            } else if (/\bBACKGROUNDCOLOR\s+\d+\s+\d+\s+\d+/.test(originalText)) {
                return [new vscode.ColorPresentation(`BACKGROUNDCOLOR ${r} ${g} ${b}`)];
            } else if (/\bSHADOWCOLOR\s+\d+\s+\d+\s+\d+/.test(originalText)) {
                return [new vscode.ColorPresentation(`SHADOWCOLOR ${r} ${g} ${b}`)];
            } else if (originalText.includes("#")) {
                const hex = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
                if (originalText.includes("'")) {
                    return [new vscode.ColorPresentation(`'#${hex}'`)];
                } else if (originalText.includes("\"")) {
                    return [new vscode.ColorPresentation(`"#${hex}"`)];
                } else {
                    return [new vscode.ColorPresentation(`#${hex}`)];
                }
            }            
            
            return [new vscode.ColorPresentation(`COLOR ${r} ${g} ${b}`)];
        }
    });
    //support for vscode breadcrumbs
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider(
        { language: 'mapserver' },
        {
            provideDocumentSymbols(document, token) {
                const symbols = [];
                const stack = [];
                
                const symbolStartRegex = /^\s*SYMBOL\b/i;
                const layerStartRegex = /^\s*LAYER\b/i;
                const classStartRegex = /^\s*CLASS\b/i;
                const nameRegex = /^\s*NAME\s+["']([^"']+)["']/i;
                const endRegex = /^\s*END\b/i;
                
                let currentLayerSymbol = null;
                let currentSymSymbol = null;
                
                for (let i = 0; i < document.lineCount; i++) {
                    const line = document.lineAt(i).text;
                    const trimmedLine = line.trim();
                    
                    if (layerStartRegex.test(trimmedLine)) {
                        const range = new vscode.Range(i, 0, i, line.length);
                        const layerIndex = line.toUpperCase().indexOf('LAYER');
                        const selectionRange = new vscode.Range(i, layerIndex, i, layerIndex + 5);
                        
                        const layerSymbol = new vscode.DocumentSymbol(
                            "LAYER",
                            "", 
                            vscode.SymbolKind.Class, 
                            range, 
                            selectionRange
                        );
                        
                        symbols.push(layerSymbol);
                        currentLayerSymbol = layerSymbol;
                        stack.push({ symbol: layerSymbol, type: 'LAYER', startLine: i });
                    }
                   
                    else if (classStartRegex.test(trimmedLine)) {
                        const range = new vscode.Range(i, 0, i, line.length);
                        const classIndex = line.toUpperCase().indexOf('CLASS');
                        const selectionRange = new vscode.Range(i, classIndex, i, classIndex + 5);
                        
                        const classSymbol = new vscode.DocumentSymbol(
                            "CLASS", 
                            "", 
                            vscode.SymbolKind.Method, 
                            range, 
                            selectionRange
                        );
                        
                        
                        if (currentLayerSymbol) {
                            currentLayerSymbol.children.push(classSymbol);
                        } else if (symbols.length > 0) {
                            symbols[symbols.length - 1].children.push(classSymbol);
                        } else {
                            symbols.push(classSymbol);
                        }
                        
                        stack.push({ symbol: classSymbol, type: 'CLASS', startLine: i });
                    }
                    else if (nameRegex.test(trimmedLine)) {
                        const match = trimmedLine.match(nameRegex);
                        if (match && match[1]) {
                            if (stack.length > 0) {
                                const name = match[1];
                                for (let j = stack.length - 1; j >= 0; j--) {
                                    const item = stack[j];
                                    if (item.symbol.name === item.type) {
                                        item.symbol.name = `${item.type}: ${name}`;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    else if (endRegex.test(trimmedLine) && stack.length > 0) {
                        const current = stack.pop();
                        if (current) {
                            const newRange = new vscode.Range(
                                current.symbol.range.start,
                                new vscode.Position(i, line.length)
                            );
                            current.symbol.range = newRange;
                            
                            if (current.type === 'LAYER') {
                                currentLayerSymbol = null;
                                
                                for (let j = stack.length - 1; j >= 0; j--) {
                                    if (stack[j].type === 'LAYER') {
                                        currentLayerSymbol = stack[j].symbol;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                
                return symbols;
            }
        }
    );
   
    context.subscriptions.push(symbolProvider);
    context.subscriptions.push(colorProvider);
    context.subscriptions.push(formatter);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};