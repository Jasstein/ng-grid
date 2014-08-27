var ngEventProvider = function (grid, $scope, domUtilityService, $timeout, rtlUtilityService) {
    var self = this;
    // The init method gets called during the ng-grid directive execution.
    self.colToMove = undefined;
    self.groupToMove = undefined;
    self.assignEvents = function() {
        // Here we set the onmousedown event handler to the header container.
        if (grid.config.jqueryUIDraggable && !grid.config.enablePinning) {
            grid.$groupPanel.find('.ngHeaderCell:not(.pinned)').droppable({
                addClasses: false,
                drop: function(event) {
                    self.onGroupDrop(event);
                }
            });
        } else {
            //Assign drag and drop events on each column header cell individually based on whether it's pinned or not
            grid.$groupPanel.on('mousedown', '.ngHeaderCell:not(.pinned)', self.onGroupMouseDown).on('dragover', '.ngHeaderCell:not(.pinned)', self.dragOver).on('drop', '.ngHeaderCell:not(.pinned)', self.onGroupDrop);

            grid.$topPanel.on('mousedown', '.ngHeaderCell:not(.pinned)', self.onHeaderMouseDown).on('dragover', '.ngHeaderCell:not(.pinned)', self.dragOver);

            if (grid.config.enableColumnReordering) {
               grid.$topPanel.on('drop', '.ngHeaderCell:not(.pinned)', self.onHeaderDrop);
            }
        }
        
        // Only allow dragging if the grid is configured for it.  Otherwise you can drag the column and do
        // nothing with it.
        $scope.$watch('renderedColumns', function() {
            if (grid.config.enableColumnReordering ||
                grid.config.showGroupPanel ||
                grid.config.jqueryUIDraggable) {
                // Don't $apply after setting the draggables.  With large scopes, and lots of grids, the performance
                // is horrible!
                // 2nd param is to use the default timeout for setTimeout
                // 3rd param is to not call $scope.$apply, since it doesn't appear to be needed
                $timeout(self.setDraggables, undefined, false);
            }
        });
    };
    
    //html5 drag and drop (dnd) event handlers
    var dragged;
    self.dragStart = function(evt){
      //FireFox requires there to be dataTransfer if you want to drag and drop.
      evt.dataTransfer.setData('text', ''); //cannot be empty string

        dragged = evt.target;
        self.styleDragStart(evt, evt.currentTarget);
    };
    self.dragEnd = function(evt) {
        self.styleDragEnd(evt.currentTarget);
    };
    self.dragEnter = function(evt) {
        count++;

        var target = evt.target;

        if (!self.isDroppable(evt.target)) {
            return;
        }

        self.styleDragEnter(dragged, target, { left: evt.clientX });
    };
    self.dragLeave = function(evt) {
        self.styleDragLeave(evt.target);
    }    
    self.dragOver = function(evt) {
        evt.preventDefault();
    };
    self.drop = function() {
        self.styleDrop();
    };

    self.reset = function() {
        grid.$topPanel.find('.ngHeaderDropBefore').removeClass('ngHeaderDropBefore');
        grid.$topPanel.find('.ngHeaderDropAfter').removeClass('ngHeaderDropAfter');    
    };
    self.isDroppable = function(target) {
        var headerContainer = $(target).closest('.ngHeaderCell');
        if (!headerContainer) {
            return false;
        }

        var headerScope = angular.element(headerContainer).scope();
        if (headerScope) {
            // If we have the same column or the target column is pinned, do nothing.
            if (self.colToMove.col === headerScope.col || headerScope.col.pinned) {
                return false;
            }
            return true;
        }        
        return false;
    };

    //drag and drop styling (shared between HTML5 and JQueryUI dnd)
    var count = 0;    
    self.styleDragStart = function(event, target) {
        count = 0;

        //Dragging started then highlight the column being dragged
        if (!self.colToMove.col.pinned) {
            $(target).addClass('ngHeaderDragHighlight');    
        }

        self.onHeaderMouseDown(event);            
    };   
    self.styleDragEnd = function(target) {
        $(target).removeClass('ngHeaderDragHighlight');

        self.reset();
    };   
    self.styleDragEnter = function(source, target, position) {
        self.reset();

        if (self.isColumnInvalid()) {
            return;
        }

        if (!self.isDroppable(target)) {
            return;
        }

        //When the helper is left of dragged column we show feedback to suggest insertion BEFORE the hovered column.
        //When the helper is right of dragged column, we show feedback to suggest insertion AFTER the hovered column.
        //In RTL, it's the opposite.
        //
        //By default, the feedback is a left or right border. 
        //Setting a border on right is not visible unless we remove the 'position: absolute' from ngHeaderSortColumn.
        //In RTL, same issue occurs but with border on the left.
        //To workaround, we remove the 'position: absolute' from ngHeaderSortColumn. We set it back in the reset function.
        //
        //It is not clear what is the purpose of that 'position: absolute'. It seems to have no effect.
        //Waiting for author to give an explanation: 
        //https://github.com/angular-ui/ng-grid/commit/edec4c9b48815d1d012381b265bdb2b30e9acf7a#diff-229e3b5420b86b2c35744389d8c6676f
        var actualTarget = $(target).closest('.ngHeaderCell');

        if ($(source).offset().left < position.left) {
            if (rtlUtilityService.isRtl) {
                $(actualTarget).addClass('ngHeaderDropBefore');
            } else  {
                $(actualTarget).addClass('ngHeaderDropAfter');    
            }
        } else if ($(source).offset().left > position.left) {
            if (rtlUtilityService.isRtl) {
                $(actualTarget).addClass('ngHeaderDropAfter');    
            } else  {
                $(actualTarget).addClass('ngHeaderDropBefore');    
            }
        }
    }
    self.styleDragLeave = function() {
        //It is possible to get two OVER callbacks before getting the OUT callback of first OVER.
        //In LTR, drag a column from right to left and hover two columns (without interruption).
        //
        //When that occured we would reset the styling which is not intented since the second OVER is still in effect.
        //To workaround, we keep track of the callbacks and only reset when we reach the last OUT callback which means nothing is dragged over.
        if (--count === 0) {
            self.reset();
        }        
    }
    self.styleDrop = function() {
        self.reset();
    };    

    //For JQueryUI
    self.setDraggables = function() {
        //Called when dragging stopped: it removes styling applied to columns 

        if (!grid.config.jqueryUIDraggable) {
            //Fix for FireFox. Instead of using jQuery on('dragstart', function) on find, we have to use addEventListeners for each column.
            var columns = grid.$root.find('.ngHeaderCell:not(.pinned)'); //have to iterate if using addEventListener
            angular.forEach(columns, function(col){
                if(col.className && col.className.indexOf("ngHeaderCell") !== -1){
                    col.setAttribute('draggable', 'true');
                    //jQuery 'on' function doesn't have  dataTransfer as part of event in handler unless added to event props, which is not recommended
                    //See more here: http://api.jquery.com/category/events/event-object/
                    if (col.addEventListener) { //IE8 doesn't have drag drop or event listeners
                        col.addEventListener('dragstart', self.dragStart);
                        col.addEventListener('dragend', self.dragEnd);
                        col.addEventListener('dragenter', self.dragEnter);
                        col.addEventListener('dragleave', self.dragLeave);
                        col.addEventListener('drop', self.drop);
                    }
                }
            });
            if (navigator.userAgent.indexOf("MSIE") !== -1){
                //call native IE dragDrop() to start dragging
                grid.$root.find('.ngHeaderCell:not(.pinned)').bind('selectstart', function () { 
                    this.dragDrop(); 
                    return false; 
                }); 
            }
        } else {
            grid.$root.find('.ngHeaderCell:not(.pinned)').draggable({
                helper: 'clone',
                appendTo: 'body',
                stack: 'div',
                addClasses: false,
                start: function(event) {
                    self.styleDragStart(event, this);
                },
                stop: function() {
                    self.styleDragEnd(this);
                }
            }).droppable({
                tolerance: 'pointer',
                drop: function(event) {
                    self.styleDrop();

                    self.onHeaderDrop(event);
                },
                out: function() {
                    self.styleDragLeave();
                },            
                over: function(event, ui) {
                    count++;
                    self.styleDragEnter(ui.draggable, event.target, ui.position);
                }
            });
        }
    };
    self.onGroupMouseDown = function(event) {
        var groupItem = $(event.target);
        // Get the scope from the header container
        if (groupItem[0].className !== 'ngRemoveGroup') {
            var groupItemScope = angular.element(groupItem).scope();
            if (groupItemScope) {
                // set draggable events
                if (!grid.config.jqueryUIDraggable) {
                    groupItem.attr('draggable', 'true');
                    if(this.addEventListener){//IE8 doesn't have drag drop or event listeners
                        this.addEventListener('dragstart', self.dragStart); 
                    }
                    if (navigator.userAgent.indexOf("MSIE") !== -1){
                        //call native IE dragDrop() to start dragging
                        groupItem.bind('selectstart', function () { 
                            this.dragDrop(); 
                            return false; 
                        });	
                    }
                }
                // Save the column for later.
                self.groupToMove = { header: groupItem, groupName: groupItemScope.group, index: groupItemScope.$index };
            }
        } else {
            self.groupToMove = undefined;
        }
    };
    self.onGroupDrop = function(event) {
        event.stopPropagation();
        // clear out the colToMove object
        var groupContainer;
        var groupScope;
        if (self.groupToMove) {
            // Get the closest header to where we dropped
            groupContainer = $(event.target).closest('.ngGroupElement'); // Get the scope from the header.
            if (groupContainer.context.className === 'ngGroupPanel') {
                $scope.configGroups.splice(self.groupToMove.index, 1);
                $scope.configGroups.push(self.groupToMove.groupName);
            } else {
                groupScope = angular.element(groupContainer).scope();
                if (groupScope) {
                    // If we have the same column, do nothing.
                    if (self.groupToMove.index !== groupScope.$index) {
                        // Splice the columns
                        $scope.configGroups.splice(self.groupToMove.index, 1);
                        $scope.configGroups.splice(groupScope.$index, 0, self.groupToMove.groupName);
                    }
                }
            }
            self.groupToMove = undefined;
            grid.fixGroupIndexes();
        } else if (self.colToMove) {
            if ($scope.configGroups.indexOf(self.colToMove.col) === -1) {
                groupContainer = $(event.target).closest('.ngGroupElement'); // Get the scope from the header.
                if (groupContainer.context.className === 'ngGroupPanel' || groupContainer.context.className === 'ngGroupPanelDescription ng-binding') {
                    $scope.groupBy(self.colToMove.col);
                } else {
                    groupScope = angular.element(groupContainer).scope();
                    if (groupScope) {
                        // Splice the columns
                        $scope.removeGroup(groupScope.$index);
                    }
                }
            }
            self.colToMove = undefined;
        }
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };
    //Header functions
    self.onHeaderMouseDown = function(event) {
        // Get the closest header container from where we clicked.
        var headerContainer = $(event.target).closest('.ngHeaderCell');
        // Get the scope from the header container
        var headerScope = angular.element(headerContainer).scope();
        if (headerScope) {
            // Save the column for later.
            self.colToMove = { header: headerContainer, col: headerScope.col };
        }
    };
    self.isColumnInvalid = function() {
        return !self.colToMove || self.colToMove.col.pinned;
    }
    self.onHeaderDrop = function(event) {
        if (self.isColumnInvalid()) {
            return;
        }

        // Get the closest header to where we dropped
        var headerContainer = $(event.target).closest('.ngHeaderCell');
        // Get the scope from the header.
        var headerScope = angular.element(headerContainer).scope();
        if (headerScope) {
            // If we have the same column or the target column is pinned, do nothing.
            if (self.colToMove.col === headerScope.col || headerScope.col.pinned) {
                return;
            }
            // Splice the columns
            $scope.columns.splice(self.colToMove.col.index, 1);
            $scope.columns.splice(headerScope.col.index, 0, self.colToMove.col);
            grid.fixColumnIndexes();
            // clear out the colToMove object
            self.colToMove = undefined;
            domUtilityService.digest($scope);
        }
    };

    self.assignGridEventHandlers = function() {
        var windowThrottle;
        var parentThrottle;

        function onWindowResize(){
            clearTimeout(windowThrottle);
            windowThrottle = setTimeout(function() {
                domUtilityService.RebuildGrid($scope,grid);
            }, 100);
        }

        function onParentResize() {
            clearTimeout(parentThrottle);
            parentThrottle = setTimeout(function() {
                domUtilityService.RebuildGrid($scope,grid);
            }, 100);
        }

        if (grid.config.tabIndex === -1) {
            grid.$viewport.attr('tabIndex', domUtilityService.numberOfGrids);
            domUtilityService.numberOfGrids++;
        } else {
            grid.$viewport.attr('tabIndex', grid.config.tabIndex);
        }

        $(window).on('resize', onWindowResize);
        $(grid.$root.parent()).on('resize', onParentResize);

        $scope.$on('$destroy', function() {
            $(grid.$root.parent()).off('resize', onParentResize);
            $(window).off('resize', onWindowResize);
        });
    };
    self.assignGridEventHandlers();
    self.assignEvents();
};
