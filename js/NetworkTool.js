/**
 * @param networkOptions.heatmap morpheus.HeatMap
 * @param networkOptions.project
 *              morpheus.Project
 * @param networkOptions.getVisibleTrackNames
 *            {Function}
 */
morpheus.NetworkTool = function (networkOptions) {
  var _this = this;
  this.getVisibleTrackNames = networkOptions.getVisibleTrackNames;
  this.project = networkOptions.project;
  this.heatmap = networkOptions.heatmap;
  var project = this.project;
  this.$el = $('<div class="container-fluid">'
    + '<div class="row">'
    + '<div data-name="configPane" class="col-xs-2"></div>'
    + '<div class="col-xs-10"><div style="position:relative;" data-name="networkDiv"></div></div>'
    + '</div></div>');

  this.tooltip = [];
  var draw = function () {
    _.debounce(_this.draw(), 100);
  };

  var trackChanged = function () {
  };
  
  project.getColumnSelectionModel().on('selectionChanged.chart', draw);
  project.getRowSelectionModel().on('selectionChanged.chart', draw);
  project.on('trackChanged.chart', trackChanged);
  this.$chart = this.$el.find('[data-name=networkDiv]');
  var $dialog = $('<div style="background:white;" title="Network"></div>');
  this.$el.appendTo($dialog);
  $dialog.dialog({
    dialogClass: 'morpheus',
    close: function (event, ui) {
      project.off('trackChanged.chart', trackChanged);
      project.getRowSelectionModel().off('selectionChanged.chart', draw);
      project.getColumnSelectionModel().off('selectionChanged.chart',
        draw);
      _this.$el.empty();
    },

    resizable: true,
    height: 600,
    width: 900
  });
  this.$dialog = $dialog;
  this.draw();
};

morpheus.NetworkTool.prototype = {
	draw: function () {
		var _this = this;
		var dataset = this.project.getSelectedDataset({
			emptyToAll: false
		});
		
		this.dataset = dataset;
		
		if (dataset.getRowCount() === 0) {
			$('<h4>Please select rows in the heat map.</h4>')
			.appendTo(this.$chart);
			return;
		}
		
		// Get protein IDs
		var heatmap = this.heatmap;
		var axisLabelVector = dataset.getRowMetadata().getByName('Majority protein IDs');
		var selectedIDs = [];
		
		for (var r = 0, rows = dataset.getRowCount() ; r < rows ; r++) {
			var id = axisLabelVector.getValue(r);
			
			id = id.split(';')[0].split('-')[0];
			
			selectedIDs.push(id);
		}
		
		//console.log(selectedIDs);
		
		// Query Neo4j
		var accStr = "'" + selectedIDs.join("','") + "'";
		//var sql = "MATCH (a)-[r:COSINE|ANTICOSINE*..5 {Drug:\"Bendamustine\"}]-(b) WHERE a.Accession IN [" + accStr + "] OR b.Accession IN [" + accStr + "] RETURN a,b,r LIMIT 100";
		var sql = "MATCH (a)-[r:COSINE|ANTICOSINE {Drug:\"Bendamustine\"}]-(b) WHERE a.Accession IN [" + accStr + "] OR b.Accession IN [" + accStr + "] RETURN a,b,r LIMIT 100";
		
		//console.log(sql);
		$('#loading-modal').modal('show');
		
		var resultPromise = neo4j_session.run(sql);
		var record, nodeA, nodeB, relationship;
		//var tableBody = $('#record-table tbody');

		resultPromise.then(result => {
			//session.close();
	
			for (var i = 0 ; i < result.records.length ; i++) {
				record = result.records[i];
				nodeA = record.get('a');
				nodeB = record.get('b');
				relationship = record.get('r');

				/*tableRow = "\t<tr>\n" +
					"\t\t<td align=\"center\">" + nodeA.properties.name + "(" + nodeA.properties.Accession + ') @ ' + nodeA.labels[0] + "</td>\n" +
					"\t\t<td align=\"center\">" + nodeB.properties.name + "(" + nodeB.properties.Accession + ') @ ' + nodeB.labels[0] + "</td>\n" +
					"\t\t<td align=\"right\">" + relationship.properties.score.toFixed(3) + "</td>\n" +
					"\t\t<td align=\"right\">" + relationship.properties.score_error.toFixed(3) + "</td>\n";

				tableBody.append(tableRow);*/

				console.log(nodeA.properties.name + "(" + nodeA.labels[0] + ")  " + 
								nodeB.properties.name + "(" + nodeB.labels[0] + ")  " +
								relationship.properties.score + "\t" + relationship.properties.score_error);
			}

			$('#loading-modal').modal('hide');
			//session.close();
			//driver.close();
		});
	}
};

/**
 *
 * @param options.dataset
 * @param options.text
 * @param options.rowIndex
 * @param options.columnIndex
 */
morpheus.NetworkTool.getTooltip = function (options) {
  for (var tipIndex = 0; tipIndex < options.tooltip.length; tipIndex++) {
    var tip = options.tooltip[tipIndex];
    var metadata;
    var index;
    if (tip.isColumns) {
      metadata = options.dataset.getColumnMetadata();
      index = options.columnIndex;
    } else {
      metadata = options.dataset.getRowMetadata();
      index = options.rowIndex;
    }
    if (index !== -1) {
      var v = metadata.getByName(tip.field);
      morpheus.HeatMapTooltipProvider.vectorToString(v,
        index, options.text, '<br>');
    }
  }
};