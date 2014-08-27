﻿var ngRowFactory = function (grid, $scope, domUtilityService, rtlUtilityService, $templateCache, $utils) {
    var self = this;
    // we cache rows when they are built, and then blow the cache away when sorting
    self.aggCache = {};
    self.parentCache = []; // Used for grouping and is cleared each time groups are calulated.
    self.dataChanged = true;
    self.parsedData = [];
    self.rowConfig = {};
    self.selectionProvider = $scope.selectionProvider;
    self.rowHeight = 30;
    self.numberOfAggregates = 0;
    self.groupedData = undefined;
    self.rowHeight = grid.config.rowHeight;
    self.rowConfig = {
        enableRowSelection: grid.config.enableRowSelection,
        rowClasses: grid.config.rowClasses,
        rowOptions: grid.config.rowOptions,        
        selectedItems: $scope.selectedItems,
        selectWithCheckboxOnly: grid.config.selectWithCheckboxOnly,
        beforeSelectionChangeCallback: grid.config.beforeSelectionChange,
        afterSelectionChangeCallback: grid.config.afterSelectionChange,
        jqueryUITheme: grid.config.jqueryUITheme,
        enableCellSelection: grid.config.enableCellSelection,
        rowHeight: grid.config.rowHeight
    };

    self.renderedRange = new ngRange(0, grid.minRowsToRender() + EXCESS_ROWS);

    // @entity - the data item
    // @rowIndex - the index of the row
    self.buildEntityRow = function(entity, rowIndex, depth, hasChildren, isExpanded) {
        // build the row
        return new ngRow(entity, self.renderedChange, self.rowConfig, self.selectionProvider, rowIndex, $utils, depth, hasChildren, isExpanded);
    };

    self.buildAggregateRow = function(aggEntity, rowIndex) {
        var agg = self.aggCache[aggEntity.aggIndex]; // first check to see if we've already built it
        if (!agg) {
            // build the row
            agg = new ngAggregate(aggEntity, self, self.rowConfig.rowHeight, grid.config.groupsCollapsedByDefault);
            self.aggCache[aggEntity.aggIndex] = agg;
        }
        agg.rowIndex = rowIndex;
        agg.offsetTop = rowIndex * self.rowConfig.rowHeight;
        return agg;
    };
    self.UpdateViewableRange = function(newRange) {
        self.renderedRange = newRange;
        self.renderedChange();
    };
    self.filteredRowsChanged = function() {
        // check for latebound autogenerated columns
        if (grid.lateBoundColumns && grid.filteredRows.length > 0) {
            grid.config.columnDefs = undefined;
            grid.buildColumns();
            grid.lateBoundColumns = false;
            $scope.$evalAsync(function() {
                $scope.adjustScrollLeft(0);
            });
        }
        self.dataChanged = true;
        if (grid.config.groups.length > 0) {
            self.getGrouping(grid.config.groups);
        }
        self.UpdateViewableRange(self.renderedRange);
    };

    self.renderedChange = function() {
        if (!self.groupedData || grid.config.groups.length < 1) {
            self.renderedChangeNoGroups();
            grid.refreshDomSizes();
            return;
        }
        self.wasGrouped = true;
        self.parentCache = [];
        var x = 0;
        var temp = self.parsedData.filter(function (e) {
            if (e.isAggRow) {
                if (e.parent && e.parent.collapsed) {
                    return false;
                }
                return true;
            }
            if (!e[NG_HIDDEN]) {
                e.rowIndex = x++;
            }
            return !e[NG_HIDDEN];
        });
        self.totalRows = temp.length;
        var rowArr = [];
        for (var i = self.renderedRange.topRow; i < self.renderedRange.bottomRow; i++) {
            if (temp[i]) {
                temp[i].offsetTop = i * grid.config.rowHeight;
                rowArr.push(temp[i]);
            }
        }
        grid.setRenderedRows(rowArr);
    };

    self.renderedChangeNoGroups = function () {
        var numberOfRowsToRender = self.renderedRange.bottomRow - self.renderedRange.topRow;
        //Number of rows picked up for rendering (note that only top level rows are considered)
        var topRowsCount = 0;
        var rowIndex = self.renderedRange.topRow;
        var renderedRowIndex = self.renderedRange.topRow;

        var rowsToRender = [];

        while (topRowsCount < numberOfRowsToRender) {
            var row = grid.filteredRows[rowIndex];
            if (row) {
                row.offsetTop = renderedRowIndex * grid.config.rowHeight;
                rowsToRender.push(row);
                ++renderedRowIndex;
                ++rowIndex;
                
                //if the row has children and is collapsed, skip children (rows with greater depth)
                if (row.isExpanded === false) {
                    while(grid.filteredRows[rowIndex] && grid.filteredRows[rowIndex].depth > row.depth) {
                        ++rowIndex;
                    }
                }

                if (row.depth === 0) {
                    ++topRowsCount;
                }
            } else {
                break;
            }
        }

        grid.setRenderedRows(rowsToRender);
    };

    self.fixRowCache = function () {
        var hierarchySize = self.getHierarchySize(grid.data);

        grid.rowCache.length = hierarchySize;
        grid.rowMap.length = hierarchySize;

        var index = 0;
        angular.forEach(grid.data, function(entry){
            index = self.fixHierarchyCache(entry, index, 0);
        });
    };

    self.getHierarchySize = function(hierarchy) {
        var size = hierarchy.length;
        angular.forEach(hierarchy, function(entry) {
            size += self.getHierarchySize(self.getChildren(entry));
        });

        return size;
    };

    self.fixHierarchyCache = function(entry, index, depth) {
        var children = self.getChildren(entry);

        grid.rowMap[index] = index;
        grid.rowCache[index] = grid.rowFactory.buildEntityRow(entry, index, depth, children.length !== 0, false, depth === 0 ? true : false);

        ++index;
        angular.forEach(children, function(child) {
            index = self.fixHierarchyCache(child, index, depth + 1);
        });

        return index;
    };

    self.getChildren = function(entry) {
        if (grid.config.entryChildProperty) {
            var children = entry[grid.config.entryChildProperty];
            if (children && Array.isArray(children)) {
                return children;
            }
        }

        return [];
    };

    //magical recursion. it works. I swear it. I figured it out in the shower one day.
    self.parseGroupData = function(g) {
        if (g.values) {
            for (var x = 0; x < g.values.length; x++){
                // get the last parent in the array because that's where our children want to be
                self.parentCache[self.parentCache.length - 1].children.push(g.values[x]);
                //add the row to our return array
                self.parsedData.push(g.values[x]);
            }
        } else {
            for (var prop in g) {
                // exclude the meta properties.
                if (prop === NG_FIELD || prop === NG_DEPTH || prop === NG_COLUMN) {
                    continue;
                } else if (g.hasOwnProperty(prop)) {
                    //build the aggregate row
                    var agg = self.buildAggregateRow({
                        gField: g[NG_FIELD],
                        gLabel: prop,
                        gDepth: g[NG_DEPTH],
                        isAggRow: true,
                        '_ng_hidden_': false,
                        children: [],
                        aggChildren: [],
                        aggIndex: self.numberOfAggregates,
                        aggLabelFilter: g[NG_COLUMN].aggLabelFilter
                    }, 0);
                    self.numberOfAggregates++;
                    //set the aggregate parent to the parent in the array that is one less deep.
                    agg.parent = self.parentCache[agg.depth - 1];
                    // if we have a parent, set the parent to not be collapsed and append the current agg to its children
                    if (agg.parent) {
                        agg.parent.collapsed = false;
                        agg.parent.aggChildren.push(agg);
                    }
                    // add the aggregate row to the parsed data.
                    self.parsedData.push(agg);
                    // the current aggregate now the parent of the current depth
                    self.parentCache[agg.depth] = agg;
                    // dig deeper for more aggregates or children.
                    self.parseGroupData(g[prop]);
                }
            }
        }
    };
    //Shuffle the data into their respective groupings.
    self.getGrouping = function(groups) {
        self.aggCache = [];
        self.numberOfAggregates = 0;
        self.groupedData = {};
        // Here we set the onmousedown event handler to the header container.
        var rows = grid.filteredRows,
            maxDepth = groups.length,
            cols = $scope.columns;

        function filterCols(cols, group) {
            return cols.filter(function(c) {
                return c.field === group;
            });
        }

        for (var x = 0; x < rows.length; x++) {
            var model = rows[x].entity;
            if (!model) {
                return;
            }
            rows[x][NG_HIDDEN] = grid.config.groupsCollapsedByDefault;
            var ptr = self.groupedData;

            for (var y = 0; y < groups.length; y++) {
                var group = groups[y];

                var col = filterCols(cols, group)[0];

                var val = $utils.evalProperty(model, group);
                val = val ? val.toString() : 'null';
                if (!ptr[val]) {
                    ptr[val] = {};
                }
                if (!ptr[NG_FIELD]) {
                    ptr[NG_FIELD] = group;
                }
                if (!ptr[NG_DEPTH]) {
                    ptr[NG_DEPTH] = y;
                }
                if (!ptr[NG_COLUMN]) {
                    ptr[NG_COLUMN] = col;
                }
                ptr = ptr[val];
            }
            if (!ptr.values) {
                ptr.values = [];
            }
            ptr.values.push(rows[x]);
        }

        //moved out of above loops due to if no data initially, but has initial grouping, columns won't be added
        if(cols.length > 0) {
            for (var z = 0; z < groups.length; z++) {
                if (!cols[z].isAggCol && z <= maxDepth) {
                    cols.splice(0, 0, new ngColumn({
                        colDef: {
                            field: '',
                            width: 25,
                            sortable: false,
                            resizable: false,
                            headerCellTemplate: '<div class="ngAggHeader"></div>',
                            pinned: grid.config.pinSelectionCheckbox
                            
                        },
                        enablePinning: grid.config.enablePinning,
                        isAggCol: true,
                        headerRowHeight: grid.config.headerRowHeight
                        
                    }, $scope, grid, domUtilityService, rtlUtilityService, $templateCache, $utils));
                }
            }
        }

        grid.fixColumnIndexes();
        $scope.adjustScrollLeft(0);
        self.parsedData.length = 0;
        self.parseGroupData(self.groupedData);
        self.fixRowCache();
    };

    if (grid.config.groups.length > 0 && grid.filteredRows.length > 0) {
        self.getGrouping(grid.config.groups);
    }
};
