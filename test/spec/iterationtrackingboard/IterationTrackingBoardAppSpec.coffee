Ext = window.Ext4 || window.Ext

Ext.require [
  'Rally.util.DateTime',
  'Rally.app.Context'
]

describe 'Rally.apps.iterationtrackingboard.IterationTrackingBoardApp', ->

  helpers
    createApp: (config)->
      now = new Date()
      tomorrow = Rally.util.DateTime.add(now, 'day', 1)
      nextDay = Rally.util.DateTime.add(tomorrow, 'day', 1)
      dayAfter = Rally.util.DateTime.add(nextDay, 'day', 1)
      @iterationData = [
        {Name:'Iteration 1', _ref:'/iteration/0', StartDate:Rally.util.DateTime.toIsoString(now), EndDate:Rally.util.DateTime.toIsoString(tomorrow)}
        {Name:'Iteration 2', _ref:'/iteration/2', StartDate:Rally.util.DateTime.toIsoString(nextDay), EndDate:Rally.util.DateTime.toIsoString(dayAfter)}
      ]

      @IterationModel = Rally.test.mock.data.WsapiModelFactory.getIterationModel()
      @iterationRecord = new @IterationModel @iterationData[0]

      @app = Ext.create('Rally.apps.iterationtrackingboard.IterationTrackingBoardApp', Ext.apply(
        context: Ext.create('Rally.app.Context',
          initialValues:
            timebox: @iterationRecord
            project:
              _ref: @projectRef
        ),
        renderTo: 'testDiv'
      , config))

      @waitForComponentReady(@app)

    getIterationFilter: ->
      iteration = @iterationData[0]

      [
        { property: 'Iteration.Name', operator: '=', value: iteration.Name },
        { property: "Iteration.StartDate", operator: '=', value: iteration.StartDate }
        { property: "Iteration.EndDate", operator: '=', value: iteration.EndDate }
      ]

    stubRequests: ->
      userstoryStub = @ajax.whenQuerying('userstory').respondWith([{
        RevisionHistory: {
          _ref: '/revisionhistory/1'
        }
      }])

      defectStub = @ajax.whenQuerying('defect').respondWith([{
        RevisionHistory: {
          _ref: '/revisionhistory/1'
        }
      }])
      defectsuiteStub = @ajax.whenQuerying('defectsuite').respondWith()
      testsetStub = @ajax.whenQuerying('testset').respondWith()
      @ajax.whenQueryingAllowedValues('userstory', 'ScheduleState').respondWith(["Defined", "In-Progress", "Completed", "Accepted"]);

      [userstoryStub, defectStub, defectsuiteStub, testsetStub]

    toggleToGridOrBoard: (view) ->
      toggler = @app.gridboard.down('rallygridboardtoggle')
      toggler.applyState toggle: view
      toggler.fireEvent 'toggle', view

    toggleToBoard: ->
      @toggleToGridOrBoard('board')

    toggleToGrid: ->
      @toggleToGridOrBoard('grid')

    stubFeatureToggle: (toggles) ->
      stub = @stub(Rally.app.Context.prototype, 'isFeatureEnabled');
      stub.withArgs(toggle).returns(true) for toggle in toggles
      stub

  beforeEach ->
    @ajax.whenReading('project').respondWith {
      TeamMembers: []
      Editors: []
    }

    @stubRequests()

    @tooltipHelper = new Helpers.TooltipHelper this

  afterEach ->
    @app?.destroy()

  describe 'when blank slate is not shown', ->
    it 'should show field picker in settings ', ->
      @createApp(isShowingBlankSlate: -> false).then =>
        @app.showFieldPicker = true
        expect(Ext.isObject(_.find(@app.getSettingsFields(), name: 'cardFields'))).toBe true

  describe 'when blank slate is shown', ->
    it 'should not show field picker in settings ', ->
      @createApp(isShowingBlankSlate: -> true).then =>
        @app.showFieldPicker = true
        expect(Ext.isEmpty(_.find(@app.getSettingsFields(), name: 'cardFields'))).toBe true

  it 'resets view on scope change', ->
    @createApp().then =>
      removeStub = @stub(@app, 'remove')

      newScope = Ext.create('Rally.app.TimeboxScope',
        record: new @IterationModel @iterationData[1]
      )

      @app.onTimeboxScopeChange newScope

      expect(removeStub).toHaveBeenCalledOnce()
      expect(removeStub).toHaveBeenCalledWith 'gridBoard'

      expect(@app.down('#gridBoard')).toBeDefined()

  it 'fires contentupdated event after board load', ->
    contentUpdatedHandlerStub = @stub()
    @createApp(
      listeners:
        contentupdated: contentUpdatedHandlerStub
    ).then =>
      contentUpdatedHandlerStub.reset()
      @app.gridboard.fireEvent('load')

      expect(contentUpdatedHandlerStub).toHaveBeenCalledOnce()

  it 'should include PortfolioItem in columnConfig.additionalFetchFields', ->
    @createApp().then =>

      expect(@app.gridboard.getGridOrBoard().columnConfig.additionalFetchFields).toContain 'PortfolioItem'

  it 'should have a default card fields setting', ->
    @createApp().then =>
      expect(@app.getSetting('cardFields')).toBe 'Parent,Tasks,Defects,Discussion,PlanEstimate'

  it 'should filter the grid to the currently selected iteration', ->
    @stubFeatureToggle ['ITERATION_TRACKING_BOARD_GRID_TOGGLE']
    requests = @stubRequests()

    @createApp().then =>
      @toggleToGrid()

      expect(request).toBeWsapiRequestWith(filters: @getIterationFilter()) for request in requests

  it 'should filter the board to the currently selected iteration', ->
    @stubFeatureToggle ['ITERATION_TRACKING_BOARD_GRID_TOGGLE']
    requests = @stubRequests()

    @createApp().then =>
      @toggleToBoard()

      expect(request).toBeWsapiRequestWith(filters: @getIterationFilter()) for request in requests

  describe '#getSettingsFields', ->

    describe 'when user is opted into beta tracking experience', ->

      it 'should have grid and board fields', ->
        @stubFeatureToggle ['ITERATION_TRACKING_BOARD_GRID_TOGGLE', 'SHOW_CARD_AGE_IN_ITERATION_BOARD_SETTINGS']

        @createApp().then =>
          settingsFields = @app.getSettingsFields()

          expect(_.find(settingsFields, {settingsType: 'grid'})).toBeTruthy()
          expect(_.find(settingsFields, {settingsType: 'board'})).toBeTruthy()

    describe 'when user is NOT opted into beta tracking experience', ->

      it 'should not have grid and board fields when BETA_TRACKING_EXPERIENCE is disabled', ->
        @stubFeatureToggle ['SHOW_CARD_AGE_IN_ITERATION_BOARD_SETTINGS']

        @createApp().then =>
          settingsFields = @app.getSettingsFields()

          expect(_.find(settingsFields, {settingsType: 'grid'})).toBeFalsy()
          expect(_.find(settingsFields, {settingsType: 'board'})).toBeTruthy()