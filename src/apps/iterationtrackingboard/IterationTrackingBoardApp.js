(function() {
    var Ext = window.Ext4 || window.Ext;

    /**
     * Iteration Tracking Board App
     * The Iteration Tracking Board can be used to visualize and manage your User Stories and Defects within an Iteration.
     */
    Ext.define('Rally.apps.iterationtrackingboard.IterationTrackingBoardApp', {
        extend: 'Rally.app.TimeboxScopedApp',
        requires: [
            'Rally.data.ModelFactory',
            'Rally.data.Ranker',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.grid.TreeGrid',
            'Rally.ui.cardboard.plugin.FixedHeader',
            'Rally.ui.cardboard.plugin.Print',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardOwnerFilter',
            'Rally.ui.gridboard.plugin.GridBoardFilterInfo',
            'Rally.ui.gridboard.plugin.GridBoardArtifactTypeChooser',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.ui.cardboard.plugin.ColumnPolicy',
            'Rally.ui.gridboard.plugin.GridBoardFilterInfo',
            'Rally.ui.gridboard.plugin.GridBoardFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardToggleable',
            'Rally.ui.grid.plugin.TreeGridExpandedRowPersistence',
            'Rally.ui.gridboard.plugin.GridBoardExpandAll',
            'Rally.ui.gridboard.plugin.GridBoardCustomView',
            'Rally.ui.filter.view.ModelFilter',
            'Rally.ui.filter.view.OwnerFilter',
            'Rally.ui.filter.view.OwnerPillFilter',
            'Rally.ui.filter.view.TagPillFilter',
            'Rally.app.Message',
            'Rally.apps.iterationtrackingboard.Column',
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        mixins: [
            'Rally.app.CardFieldSelectable',
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        componentCls: 'iterationtrackingboard',
        alias: 'widget.rallyiterationtrackingboard',

        settingsScope: 'project',
        scopeType: 'iteration',

        config: {
            defaultSettings: {
                showCardAge: true,
                cardAgeThreshold: 3
            }
        },

        onScopeChange: function(scope) {
            Rally.data.ModelFactory.getModels({
                types: ['User Story', 'Defect', 'Defect Suite', 'Test Set'],
                context: this.getContext().getDataContext(),
                success: function(models) {
                    var compositeModel = Rally.domain.WsapiModelBuilder.buildCompositeArtifact(_.values(models), this.getContext());
                    this._addGridBoard(compositeModel);
                },
                scope: this
            });
        },

        getSettingsFields: function () {
            var fields = this.callParent(arguments);

            fields.push({
                type: 'cardage',
                config: {
                    margin: '0 0 0 80',
                    width: 300
                }
            });

            return fields;
        },

        _addGridBoard: function(compositeModel) {
            var plugins = ['rallygridboardaddnew'],
                context = this.getContext();

            if (context.isFeatureEnabled('EXPAND_ALL_TREE_GRID_CHILDREN')) {
                plugins.push('rallygridboardexpandall');
            }

            if (context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE')) {
                plugins.push({
                    ptype: 'rallygridboardfiltercontrol',
                    filterControlConfig: {
                        cls: 'small gridboard-filter-control',
                        margin: '3 10 3 7',
                        stateful: true,
                        stateId: context.getScopedStateId('iteration-tracking-filter-button'),
                        items: [
                            this._createOwnerFilterItem(context),
                            this._createTagFilterItem(context),
                            {
                                xtype: 'rallymodelfilter',
                                models: compositeModel.getArtifactComponentModels()
                            }
                        ]
                    }
                });
            } else {
                plugins.push('rallygridboardownerfilter');
            }

            plugins.push('rallygridboardtoggleable');
            var alwaysSelectedValues = ['FormattedID', 'Name', 'Owner'];
            if (this.getContext().getWorkspace().WorkspaceConfiguration.DragDropRankingEnabled) {
                alwaysSelectedValues.push('DragAndDropRank');
            }

            if (!context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE')) {
                plugins.push({
                    ptype: 'rallygridboardfilterinfo',
                    isGloballyScoped: Ext.isEmpty(this.getSetting('project')) ? true : false,
                    stateId: 'iteration-tracking-owner-filter-' + this.getAppId()
                });
            }

            plugins.push({
                ptype: 'rallygridboardfieldpicker',
                headerPosition: 'left',
                gridFieldBlackList: [
                    'ObjectID',
                    'Description',
                    'DisplayColor',
                    'Notes',
                    'Subscription',
                    'Workspace',
                    'Changesets',
                    'RevisionHistory',
                    'Children'
                ],
                boardFieldBlackList: [
                    'ObjectID',
                    'Description',
                    'DisplayColor',
                    'Notes',
                    'Rank',
                    'DragAndDropRank',
                    'Subscription',
                    'Workspace',
                    'Changesets',
                    'RevisionHistory',
                    'PortfolioItemType',
                    'StateChangedDate',
                    'Children'
                ],
                alwaysSelectedValues: alwaysSelectedValues,
                modelNames: this._getModelNames(compositeModel),
                boardFieldDefaults: (this.getSetting('cardFields') && this.getSetting('cardFields').split(',')) ||
                    ['Parent', 'Tasks', 'Defects', 'Discussion', 'PlanEstimate']
            });

            if (context.isFeatureEnabled('ITERATION_TRACKING_CUSTOM_VIEWS')) {
                plugins.push('rallygridboardcustomview');
            }

            if (context.isFeatureEnabled('SHOW_ARTIFACT_CHOOSER_ON_ITERATION_BOARDS') && !context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE')) {
                plugins.push({
                    ptype: 'rallygridboardartifacttypechooser',
                    artifactTypePreferenceKey: 'artifact-types',
                    showAgreements: true
                });
            }

            this.gridBoardPlugins = plugins;
            this._addGrid(compositeModel);
        },

        _addGrid: function(compositeModel){
            var context = this.getContext();

            this.remove('gridBoard');

            this.gridboard = this.add({
                itemId: 'gridBoard',
                xtype: 'rallygridboard',
                stateId: 'iterationtracking-gridboard',
                context: context,
                plugins: this.gridBoardPlugins,
                modelNames: this._getModelNames(compositeModel),
                cardBoardConfig: {
                    serverSideFiltering: context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE'),
                    plugins: [
                        {ptype: 'rallycardboardprinting', pluginId: 'print'},
                        {ptype: 'rallyfixedheadercardboard'}
                    ],
                    columnConfig: {
                        xtype: 'iterationtrackingboardcolumn',
                        additionalFetchFields: ['PortfolioItem'],
                        plugins: [{
                            ptype: 'rallycolumnpolicy',
                            app: this
                        }]
                    },
                    cardConfig: {
                        showAge: this.getSetting('showCardAge') ? this.getSetting('cardAgeThreshold') : -1
                    },
                    listeners: {
                        filter: this._onBoardFilter,
                        filtercomplete: this._onBoardFilterComplete
                    }
                },
                gridConfig: this._getGridConfig(compositeModel),
                addNewPluginConfig: {
                    style: {
                        'float': 'left'
                    }
                },
                listeners: {
                    load: this._onLoad,
                    toggle: this._onToggle,
                    recordupdate: this._publishContentUpdatedNoDashboardLayout,
                    recordcreate: this._publishContentUpdatedNoDashboardLayout,
                    scope: this
                }
            });
        },

        _createOwnerFilterItem: function(context) {
            var isPillPickerEnabled = context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE'),
                projectRef = context.getProjectRef();

            if (isPillPickerEnabled) {
                return {
                    xtype: 'rallyownerpillfilter',
                    margin: '-15 0 5 0',
                    filterChildren: this.getContext().isFeatureEnabled('S58650_ALLOW_WSAPI_TRAVERSAL_FILTER_FOR_MULTIPLE_TYPES'),
                    project: projectRef,
                    showPills: false,
                    showClear: true
                };
            } else {
                return {
                    xtype: 'rallyownerfilter',
                    margin: '5 0 5 0',
                    filterChildren: this.getContext().isFeatureEnabled('S58650_ALLOW_WSAPI_TRAVERSAL_FILTER_FOR_MULTIPLE_TYPES'),
                    project: projectRef
                };
            }

        },

        _createTagFilterItem: function(context) {
            var filterUiImprovementsToggleEnabled = context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE');
            return {
                xtype: 'rallytagpillfilter',
                margin: filterUiImprovementsToggleEnabled ? '-15 0 5 0' : '5 0 5 0',
                showPills: filterUiImprovementsToggleEnabled,
                showClear: filterUiImprovementsToggleEnabled,
                remoteFilter: filterUiImprovementsToggleEnabled
            };
        },

        _getGridConfig: function(compositeModel, columns) {
            var context = this.getContext(),
                stateString = 'iteration-tracking-treegrid',
                stateId = context.getScopedStateId(stateString),
                header = this.items.getAt(0),
                treeGridHeight =  this.container.getSize().height;

            if (header){
                treeGridHeight -= header.getHeight();
            }

            var gridConfig = {
                storeConfig: {
                    autoLoad: context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE') ? false : true
                },
                plugins: [],
                columnCfgs: this._getGridColumns(),
                enableBulkEdit: context.isFeatureEnabled('BETA_TRACKING_EXPERIENCE'),
                stateId: stateId,
                stateful: true,
                height: treeGridHeight
            };

            Ext.apply(gridConfig, {
                xtype: 'rallytreegrid',
                model: ['User Story', 'Defect', 'Defect Suite', 'Test Set'],
                enableHierarchy: true,
                filters: [this.context.getTimeboxScope().getQueryFilter()],
                treeColumnRenderer: function(value, metaData, record, rowIdx, colIdx, store, view) {
                    store = store.treeStore || store;
                    return Rally.ui.renderer.RendererFactory.getRenderTemplate(store.model.getField('FormattedID')).apply(record.data);
                },
                columnCfgs: columns ? this._getGridColumns(columns) : null,
                defaultColumnCfgs: this._getGridColumns(),
                pageResetMessages: [Rally.app.Message.timeboxScopeChange],
                enableColumnFiltering: this.getContext().isFeatureEnabled('TREE_GRID_COLUMN_FILTERING'),
                disableColumnMenus: !this.getContext().isFeatureEnabled('TREE_GRID_COLUMN_FILTERING'),
                showSummary: true,
                summaryColumns: this._getSummaryColumnConfig(),
                enableRanking: this.getContext().getWorkspace().WorkspaceConfiguration.DragDropRankingEnabled
            });

            if (context.isFeatureEnabled('EXPAND_ALL_TREE_GRID_CHILDREN')) {
                gridConfig.plugins.push('rallytreegridexpandedrowpersistence');
            }

            return gridConfig;
        },

        _getSummaryColumnConfig: function() {
            var taskUnitName = this.getContext().getWorkspace().WorkspaceConfiguration.TaskUnitName,
                planEstimateUnitName = this.getContext().getWorkspace().WorkspaceConfiguration.IterationEstimateUnitName;

            return [
                {
                    field: 'PlanEstimate',
                    type: 'sum',
                    units: planEstimateUnitName
                },
                {
                    field: 'TaskEstimateTotal',
                    type: 'sum',
                    units: taskUnitName
                },
                {
                    field: 'TaskRemainingTotal',
                    type: 'sum',
                    units: taskUnitName
                }
            ];
        },

        _getGridColumns: function(columns) {
            var result = ['FormattedID', 'Name', 'ScheduleState', 'Blocked', 'PlanEstimate', 'TaskStatus', 'TaskEstimateTotal', 'TaskRemainingTotal', 'Owner', 'DefectStatus', 'Discussion'];

            if (columns) {
                result = columns;
            }
            _.pull(result, 'FormattedID');

            return result;
        },

        _getModelNames: function(compositeModel) {
            return _.pluck(compositeModel.getArtifactComponentModels(), 'displayName');
        },

        _onLoad: function() {
            this._publishContentUpdated();
            this.recordComponentReady();
        },

        _onBoardFilter: function() {
            this.setLoading(true);
        },

        _onBoardFilterComplete: function() {
            this.setLoading(false);
        },

        _onToggle: function(toggleState) {
            var appEl = this.getEl();

            if (toggleState === 'board') {
                appEl.replaceCls('grid-toggled', 'board-toggled');
            } else {
                appEl.replaceCls('board-toggled', 'grid-toggled');
            }
            this._publishContentUpdated();
        },

        _publishContentUpdated: function() {
            this.fireEvent('contentupdated');
        },

        _publishContentUpdatedNoDashboardLayout: function() {
            this.fireEvent('contentupdated', {dashboardLayout: false});
        }
    });
})();
