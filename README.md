# Mapfile Syntax Extension

## Features

### Syntax Highlighting

The extension provides comprehensive syntax highlighting for MapServer configuration files (.map files), making it easier to read and work with your map configurations:

- Clear distinction between different elements like layers, classes, styles
- Special highlighting for MapServer keywords and functions
- Recognition of string values, numbers, and expressions
- Proper highlighting of comments

### Color Decorators

The extension recognizes color values in your MapServer configuration files and provides helpful visual cues:

- In-line color previews for hex codes (#FF0000), RGB values
- Color picker integration for easy selection and modification of colors

![Screenshot from 2025-04-15 22-33-09](https://github.com/user-attachments/assets/641717ce-df6f-4c3e-86e7-5e59f57f2a19)


### Code Snippets

Simply start typing to see available snippets or use the snippet picker (Ctrl+Space).

### Breadcrumbs

Navigate complex MapServer files with ease using the breadcrumbs feature:

- Hierarchical view of your .map file structure
- Quick navigation between map, layers, classes, and styles
- Visual representation of the nesting level of each element
- Ability to quickly jump to any section of your configuration

![Screenshot from 2025-04-15 22-26-27](https://github.com/user-attachments/assets/0b920a88-05ec-42f2-ac88-2d608b0e5ddf)


### Code Formatting

Keep your MapServer configuration files clean and consistent with our code formatter:

- Automatic indentation based on nesting level
- Consistent spacing and line breaks
- Option to enforce specific formatting rules

### Converting WMS URL to map2img (old shp2img) command

This extension provides an easy way to convert MapServer WMS request URLs to map2img commands for debugging.

You can use this feature in two ways:

1. Using the command from the command palette:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Convert WMS URL to map2img command"
   - Enter the WMS URL when prompted

2. By selecting a WMS URL in the editor:
   - Select the complete WMS URL
   - Right-click and select "Convert selected WMS URL to map2img command"
   - The selected URL will be replaced with the equivalent map2img command

You can also use the keyboard shortcut `Ctrl+Alt+W` (or `Cmd+Alt+W` on Mac) to start the conversion.

## Usage Examples

Convert a URL like:
```
https://example.com/map=/path/test.map&LAYERS=test&FORMAT=image%2Fpng&SRS=EPSG%3A2056&TRANSPARENT=TRUE&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&BBOX=2603760,1253358,2610271,1254986&WIDTH=4069&HEIGHT=1017
```

To a map2img debugging command:
```
map2img -m /path/test.map -l test -e 2603760 1253358 2610271 1254986 -s 4069 1017
```

## Requirements

* Visual Studio Code version 1.75.0 or higher
