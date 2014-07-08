(function() {

"use strict";

/* jasmine specs for data hierarchy go here */

describe('a data hierarchy', function() {
    var ngGrid;

    var $dUtils;
    var $scope;
    var $linker;
    var $cache;
    var element;
    var scope;

    // Load the ngGrid module
    beforeEach(module('ngGrid'));

    beforeEach(inject(function ($rootScope, $domUtilityService, $templateCache, $compile) {
        $scope = $rootScope.$new();
        $dUtils = $domUtilityService;
        $linker = $compile;
        $cache = $templateCache;

        element = angular.element(
            '<div ng-grid="gridOptions" style="width: 1000px; height: 1000px"></div>'
        );

        scope = $rootScope;

        scope.columnDefs = [
            { field: 'name', displayName: 'Name' },
            { field: 'sex', displayName: 'Gender' }
        ];

        scope.gridData = [
            { "name": "Moroni", "age": 50, "sex": "male", "childs": [
                    { "name": "Moroni Jr.", "age": 24, "sex": "male", "childs": [
                        { "name": "Suzanna", "age": 2, "sex": "female" }
                    ]}
                ]
            },
            { "name": "Petit", "age": 50, "sex": "male" },
            { "name": "Tiancum", "age": 43, "sex": "female", "childs": [
                    { "name": "Miss Tiancum", "age": 17, "sex": "female" }
                ]
            },
            { "name": "Jacob", "age": 27, "sex": "male", "childs": [
                    { "name": "Little Jacob", "age": 3, "sex": "male" },
                    { "name": "Jacobian", "age": 2, "sex": "male" }
                ]
            },
            { "name": "Nephi", "age": 29, "sex": "female", "childs": [
                    { "name": "Nephi 1", "age": 5, "sex": "female" },
                    { "name": "Nephi 2", "age": 4, "sex": "female" },
                    { "name": "Nephi 3", "age": 2, "sex": "male" }
                ]
            },
            { "name": "Enos", "age": 34 },
        ];

        scope.sortInfo = {
            fields: [],
            directions: []
        };

        scope.gridOptions = {
            columnDefs: 'columnDefs',
            data: 'gridData',
            enableSorting: true,
            entryChildProperty: 'childs',
            filterOptions: {
                filterText: '',
                useExternalFilter: false
            },
            primaryKey: 'name',
            selectedItems: [],
            sortInfo: scope.sortInfo,
            watchData: 'deep'
        };

        ngGrid = $compile(element)(scope);
        
        scope.$digest();
    }));

    describe('where the first item is selected', function() {
        var renderedRows;

        beforeEach(inject(function() {
            renderedRows = ngGrid.data('$scope').renderedRows;

            scope.gridOptions.selectRowByKey(scope.gridData[0].name);
        }));

        it('should have the first row selected', function() {
            expect(renderedRows[0].selected).toEqual(true);

            expect(scope.gridOptions.getSelectedKeys()).toEqual([scope.gridData[0].name]);
        });

        describe('where all items are collapsed', function() {
            it('should have as many rendered rows as the data hierarchy has first level items', function() {
                expect(renderedRows.length).toEqual(scope.gridData.length);
            });

            it('should render rows in the same order as the data hierarchy first level items', function() {
                for (var index = 0; index < renderedRows.length; ++index) {
                    expect(renderedRows[index].entity).toEqual(scope.gridData[index]);
                }
            });

            it('should have the "isExpanded" flag set to "false" for all rendered rows', function() {
                for (var index = 0; index < renderedRows.length; ++index) {
                    expect(renderedRows[index].isExpanded).toEqual(false);
                }
            });

            it('should have the "hasChildren" flag set to "true" for all rendered rows with children', function() {
                for (var index = 0; index < renderedRows.length; ++index) {
                    expect(renderedRows[index].hasChildren).toEqual(scope.gridData[index].childs !== undefined && scope.gridData[index].childs.length !== 0);
                }
            });

            describe('and a child item is expanded', function() {
                beforeEach(inject(function() {
                    renderedRows[0].toggleExpand(); //expand parent
                    renderedRows[1].toggleExpand(); //expand item to test
                    renderedRows[0].toggleExpand(); //collapse parent
                }));

                it('should not have an expanded parent row', function() {
                    expect(renderedRows[0].isExpanded).toEqual(false);
                });

                it('should not render the child item or its children', function() {
                    expect(renderedRows[0].entity).toEqual(scope.gridData[0]);
                    expect(renderedRows[1].entity).not.toEqual(scope.gridData[0].childs[0]);
                });
            });

            describe('and filtering with "Moroni"', function() {
                beforeEach(inject(function() {
                    var rowsUpdated = false;
                    scope.$on('ngGridEventRows', function() {
                        rowsUpdated = true;
                    });

                    scope.gridOptions.filterOptions.filterText = 'Moroni';
                    scope.$digest();

                    waitsFor(function() { return rowsUpdated; }, 'wait for filter update', 500);
                }));

                it('should show rows with "Moroni"', function() {
                    expect(renderedRows.length).toEqual(1);
                    expect(renderedRows[0].entity).toEqual(scope.gridData[0]);
                });
            });
        });

        describe('where the first item is expanded', function() {
            beforeEach(inject(function() {
                renderedRows[0].toggleExpand();
            }));

            it('should have the expanded item "isExpanded" flag set to "true"', function() {
                expect(renderedRows[0].isExpanded).toEqual(true);
            });

            it('should render child row under its parent item', function() {
                expect(renderedRows[0].entity).toEqual(scope.gridData[0]);
                expect(renderedRows[1].entity).toEqual(scope.gridData[0].childs[0]);
            });

            it('should have the expanded item childs "isExpanded" flag set to "false"', function() {
                expect(renderedRows[1].isExpanded).toEqual(false);
            });

            it('should have as many rendered rows as the data hierarchy has first level items + the number of child items (1) for expanded items', function() {
                expect(renderedRows.length).toEqual(scope.gridData.length + scope.gridData[0].childs.length);
            });

            describe('and a child is added to the first item', function() {
                beforeEach(inject(function() {
                    var rowsUpdated = false;
                    scope.$on('ngGridEventRows', function(ev, args) {
                        rowsUpdated = true;
                    });

                    //get expanded keys
                    var expanded = scope.gridOptions.getExpandedKeys();
                    scope.gridData[0].childs.push({ "name": "Moroni Jr. II", "age": 17 });
                    scope.$digest();

                    waitsFor(function() { return rowsUpdated; }, 'wait for gridData update', 500);
                    //set expanded keys -- must be done manually
                    angular.forEach(expanded, function(key) {
                        scope.gridOptions.expandRowByKey(key);
                    });
                }));

                it('should have the expanded item "isExpanded" flag set to "true"', function() {
                    expect(renderedRows[0].isExpanded).toEqual(true);
                });

                it('should have the "hasChildren" flag set to "true"', function() {
                    expect(renderedRows[0].hasChildren).toEqual(true);
                });

                it('should render 2 child rows under its parent item', function() {
                    expect(renderedRows[0].entity).toEqual(scope.gridData[0]);
                    expect(renderedRows[1].entity).toEqual(scope.gridData[0].childs[0]);
                    expect(renderedRows[2].entity).toEqual(scope.gridData[0].childs[1]);
                });

                it('should have as many rendered rows as the data hierarchy has first level items + the number of child items (2) for expanded items', function() {
                    expect(renderedRows.length).toEqual(scope.gridData.length + scope.gridData[0].childs.length);
                });
            });

            describe('and children of the first item are removed', function() {
                beforeEach(inject(function() {
                    var rowsUpdated = false;
                    scope.$on('ngGridEventRows', function() {
                        rowsUpdated = true;
                    });

                    scope.gridData[0].childs.splice(0, 1);
                    scope.$digest();

                    waitsFor(function() { return rowsUpdated; }, 'wait for gridData update', 500);
                }));

                it('should have the "hasChildren" flag set to "false"', function() {
                    expect(renderedRows[0].hasChildren).toEqual(false);
                });

                it('should render no child row under its parent item', function() {
                    expect(renderedRows[0].entity).toEqual(scope.gridData[0]);
                    expect(renderedRows[1].entity).toEqual(scope.gridData[1]);
                });

                it('should have as many rendered rows as the data hierarchy has first level items + the number of child items (0) for expanded items', function() {
                    expect(renderedRows.length).toEqual(scope.gridData.length + scope.gridData[0].childs.length);
                });
            });

            describe('and adding a column', function() {
                beforeEach(inject(function() {
                    var columnsUpdated = false;
                    scope.$on('ngGridEventColumns', function() {
                        columnsUpdated = true;
                    });

                    scope.columnDefs.push({ field: 'age', displayName: 'Age' });
                    scope.$digest();

                    waitsFor(function() { return columnsUpdated; }, 'wait for columns to update', 500);
                }));

                it('should leave expanded rows expanded', function() {
                    expect(renderedRows[0].isExpanded).toEqual(true);
                });

                it('should leave selected row as it was', function() {
                    expect(renderedRows[0].selected).toEqual(true);
                    expect(scope.gridOptions.getSelectedKeys()).toEqual([scope.gridData[0].name]);
                });
            });

            describe('and removing a column', function() {
                beforeEach(inject(function() {
                    var columnsUpdated = false;
                    scope.$on('ngGridEventColumns', function() {
                        columnsUpdated = true;
                    });

                    scope.columnDefs.splice(1, 1);
                    scope.$digest();

                    waitsFor(function() { return columnsUpdated; }, 'wait for columns to update', 500);
                }));

                it('should leave expanded rows expanded', function() {
                    expect(renderedRows[0].isExpanded).toEqual(true);
                });

                it('should leave selected row as it was', function() {
                    expect(renderedRows[0].selected).toEqual(true);
                    expect(scope.gridOptions.getSelectedKeys()).toEqual([scope.gridData[0].name]);
                });
            });
        });

        describe('where all items are expanded', function() {
            beforeEach(inject(function() {
                expandRows();
                scope.$digest();
            }));

            it('should contain all the items from the data hierarchy', function() {
                expect(renderedRows.length).toEqual(14);
            });

            describe('and filtering with "Suzanna"', function() {
                beforeEach(inject(function() {
                    var rowsUpdated = false;
                    scope.$on('ngGridEventRows', function() {
                        rowsUpdated = true;
                    });

                    scope.gridOptions.filterOptions.filterText = 'Suzanna';
                    scope.$digest();

                    waitsFor(function() { return rowsUpdated; }, 'wait for filter update', 500);
                }));

                it('should show rows with "Suzanna"', function() {
                    var suzannaArray = $.grep(renderedRows, function(row) {
                        return row.entity.name === 'Suzanna';
                    });

                    expect(suzannaArray.length).toEqual(1);
                });

                it('should show rows that are parents of "Suzanna"', function() {
                    var parentOfSuzanna = scope.gridData[0].childs[0];
                    var grandParentOfSuzanna = scope.gridData[0];

                    var parentsArray = $.grep(renderedRows, function(row) {
                        return row.entity === parentOfSuzanna || row.entity === grandParentOfSuzanna;
                    });

                    expect(parentsArray.length).toEqual(2);
                });

                it('should not show rows that are not parents of "Suzanna"', function() {
                    expect(renderedRows.length).toEqual(3);
                });
            });

             describe('and filtering with "q123q123q123"', function() {
                beforeEach(inject(function() {
                    var rowsUpdated = false;
                    scope.$on('ngGridEventRows', function() {
                        rowsUpdated = true;
                    });

                    scope.gridOptions.filterOptions.filterText = 'q123q123q123';
                    scope.$digest();

                    waitsFor(function() { return rowsUpdated; }, 'wait for filter update', 500);
                }));

                it('should show no row', function() {
                    expect(renderedRows.length).toEqual(0);
                });
            });
        });
    });

    function expandRows() {
        var renderedRows = ngGrid.data('$scope').renderedRows;
        for (var index = 0; index < renderedRows.length; ++index) {
            if (renderedRows[index].hasChildren) {
                renderedRows[index].toggleExpand();
            }
        }
    }
});

})();
