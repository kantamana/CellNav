# CellNav

A navigation bar drawn as a tessellation of cells, where each cell holds a label or image that bends to fit the cell's outline. Designed to be dropped into other websites.

## Language

**Item**:
One navigable entry: a label, a destination, and optionally an image.
_Avoid_: link, menu entry, tab

**Shape**:
A closed outline on the plane that content can be fitted into.
_Avoid_: polygon, region, area

**Layout**:
A rule that turns a set of Items into Shapes, one per Item.
_Avoid_: tessellation, arrangement

**Boundary**:
The outer Shape a Layout fills; everything outside it is empty. By default the whole box.
_Avoid_: border, frame, mask, container

**Seed**:
A fixed point from which a Voronoi Layout grows one Shape. Seeds never move.
_Avoid_: point, site, particle

**Stretch**:
How much a Layout elongates its Shapes horizontally.
_Avoid_: aspect, squash

**Warp**:
The mapping that bends a piece of content (text or image) so it fills a Shape.
_Avoid_: distort, transform

**Fill**:
What a Shape contains: text, an image, a flat color, or another Layout.
_Avoid_: content, contents, texture

**Cell**:
One Shape bound to one Item, together with its Fill and Behavior. The unit the user sees and clicks.
_Avoid_: tile, bubble, region

**Behavior**:
How a Cell reacts to the user: linking, highlighting, marking itself active.
_Avoid_: interaction, handler, effect

**Active item**:
The Item for the page the visitor is on. Its Cell is outlined and marked as the current page.
_Avoid_: selected, current, highlighted

**Label**:
The Item's text, drawn as letter shapes inside its Cell.
_Avoid_: text, caption, title

**Outline**:
The edge of a Cell's Shape.
_Avoid_: border, stroke, edge

**Effect**:
A distortion applied to the Label or Outline of chosen Cells, either always or only while they are hovered, focused or active. It need not move.
_Avoid_: animation, filter

**Nested Layout**:
A Fill that is itself a Layout, so a Cell's Shape is subdivided into smaller Cells.
_Avoid_: sub-menu, child nav, recursion

**Longest Axis**:
The direction along which a Shape is longest. Text in that Shape runs along it and is never upside down.
_Avoid_: main direction, orientation

**Spec**:
The plain-data description of a whole CellNav, from which every packaging (builder, tag, wrapper) is built.
_Avoid_: config, options, props
