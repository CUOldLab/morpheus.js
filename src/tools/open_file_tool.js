morpheus.OpenFileTool = function (options) {
  this.options = options || {};
};

morpheus.OpenFileTool.OPEN_FILE_ACTION_OPTIONS = [
  {
    name: 'Open session',
    value: 'Open session'
  }, {
    name: 'Open dataset in new tab',
    value: 'open'
  }, {
    name: 'Append rows to current dataset',
    value: 'append'
  }, {
    name: 'Append columns to current dataset',
    value: 'append columns'
  }, {
    name: 'Overlay onto current dataset',
    value: 'overlay'
  }, {divider: true}, {
    name: 'Annotate columns',
    value: 'Annotate Columns'
  }, {
    name: 'Annotate rows',
    value: 'Annotate Rows'
  }, {
    divider: true
  }, {
    name: 'Open dendrogram',
    value: 'Open dendrogram'
  }];

morpheus.OpenFileTool.prototype = {
  toString: function () {
    return 'Open' + (this.options.file != null ? (' - ' + this.options.file.name) : '');
  },
  gui: function () {
    var params = [
      {
        name: 'open_file_action',
        value: 'open',
        type: 'bootstrap-select',
        options: morpheus.OpenFileTool.OPEN_FILE_ACTION_OPTIONS
      }];

    if (this.options.file == null) { // pick file and action
      params.options = {
        size: 'modal-lg',
        cancel: false,
        ok: false
      };
    } else {
      var extension = morpheus.Util.getExtension(
        morpheus.Util.getFileName(this.options.file));
      if (extension === 'json') { // TODO no gui needed
        params[0].options = params[0].options.filter(function (opt) {
          return opt.value != null &&
            ( opt.value === 'Open session' || opt.value === 'open' ||
              opt.value === 'overlay' || opt.value.indexOf('append') !== -1);
        });
      } else if (extension === 'gct') {
        params[0].options = params[0].options.filter(function (opt) {
          return opt.value != null &&
            (opt.value === 'open' || opt.value === 'overlay' ||
              opt.value.indexOf('append') !== -1);
        });
      }
    }
    return params;
  },
  init: function (project, form, initOptions) {
    var _this = this;

    if (this.options.file == null) {

      form.setVisible('open_file_action', false);
      var $div = $('<div></div>');
      var $ok = $(
        '<div style="display:none;padding:15px;text-align:right;"><button name="ok" type="button" class="btn' +
        ' btn-default">OK</button></div>');
      $ok.find('[name=ok]').on('click', function () {
        _this.ok();
      });
      var filePicker = new morpheus.FilePicker({
        fileCallback: function (fileOrUrl) {
          $div.hide();
          $ok.show();
          _this.options.file = fileOrUrl;
          // if it's a file, check file type and update choices
          var extension = morpheus.Util.getExtension(
            morpheus.Util.getFileName(_this.options.file));
          if (extension === 'json') { // TODO no gui needed
            form.setOptions('open_file_action',
              morpheus.OpenFileTool.OPEN_FILE_ACTION_OPTIONS.filter(
                function (opt) {
                  return opt.value != null &&
                    (opt.value === 'Open session' || opt.value === 'open' ||
                      opt.value === 'overlay' ||
                      opt.value.indexOf('append') !== -1);
                }));
          } else if (extension === 'gct') {
            form.setOptions('open_file_action',
              morpheus.OpenFileTool.OPEN_FILE_ACTION_OPTIONS.filter(
                function (opt) {
                  return opt.value != null &&
                    (opt.value === 'open' || opt.value === 'overlay' ||
                      opt.value.indexOf('append') !== -1);
                }));
          }
          form.setVisible('open_file_action', true);
        },
        optionsCallback: function (heatMapOptions) {
          $div.hide();
          $ok.show();
          _this.options.file = heatMapOptions.dataset;
          form.setVisible('open_file_action', true);
          form.setOptions('open_file_action',
            morpheus.OpenFileTool.OPEN_FILE_ACTION_OPTIONS.filter(
              function (opt) {
                return opt.value != null &&
                  (opt.value === 'open' || opt.value === 'overlay' ||
                    opt.value.indexOf('append') !== -1);
              }));
        }
      });
      filePicker.$el.appendTo($div);
      $ok.appendTo(form.$form);
      $div.appendTo(form.$form);
    }
  },

  execute: function (options) {
    var _this = this;
    var isInteractive = this.options.file == null;
    var heatMap = options.heatMap;
    if (!isInteractive) {
      options.input.file = this.options.file;
    }

    var project = options.project;
    if (options.input.open_file_action === 'Open session') {
      return morpheus.Util.getText(options.input.file).done(function (text) {
        var options = JSON.parse(text);
        options.tabManager = heatMap.getTabManager();
        options.focus = true;
        options.inheritFromParent = false;
        options.landingPage = heatMap.options.landingPage;
        new morpheus.HeatMap(options);
      }).fail(function (err) {
        morpheus.FormBuilder.showMessageModal({
          title: 'Error',
          message: 'Unable to load session',
          focus: document.activeElement
        });
      });
    } else if (options.input.open_file_action === 'append columns'
      || options.input.open_file_action === 'append'
      || options.input.open_file_action === 'open'
      || options.input.open_file_action === 'overlay') {
      return new morpheus.OpenDatasetTool().execute(options);
    } else if (options.input.open_file_action === 'Open dendrogram') {
      morpheus.HeatMap.showTool(new morpheus.OpenDendrogramTool(
        options.input.file), options.heatMap);
    } else { // annotate rows or columns
      var d = $.Deferred();
      var isAnnotateColumns = options.input.open_file_action ==
        'Annotate Columns';
      var fileOrUrl = options.input.file;
      var dataset = project.getFullDataset();
      var fileName = morpheus.Util.getFileName(fileOrUrl);
      if (morpheus.Util.endsWith(fileName, '.cls')) {
        var result = morpheus.Util.readLines(fileOrUrl);
        result.always(function () {
          d.resolve();
        });
        result.done(function (lines) {
          _this.annotateCls(heatMap, dataset, fileName,
            isAnnotateColumns, lines);
        });
      } else if (morpheus.Util.endsWith(fileName, '.gmt')) {
        morpheus.ArrayBufferReader.getArrayBuffer(fileOrUrl, function (
          err,
          buf) {
          d.resolve();
          if (err) {
            throw new Error('Unable to read ' + fileOrUrl);
          }
          var sets = new morpheus.GmtReader().read(
            new morpheus.ArrayBufferReader(new Uint8Array(
              buf)));
          _this.promptSets(dataset, heatMap, isAnnotateColumns,
            sets, morpheus.Util.getBaseFileName(
              morpheus.Util.getFileName(fileOrUrl)));
        });

      } else {
        var result = morpheus.Util.readLines(fileOrUrl);
        result.done(function (lines) {
          _this.prompt(lines, dataset, heatMap, isAnnotateColumns);
        }).always(function () {
          d.resolve();
        });
        return d;
      }

    }
  },
  annotateCls: function (heatMap, dataset, fileName, isColumns, lines) {
    if (isColumns) {
      dataset = morpheus.DatasetUtil.transposedView(dataset);
    }
    var assignments = new morpheus.ClsReader().read(lines);
    if (assignments.length !== dataset.getRowCount()) {
      throw new Error(
        'Number of samples in cls file does not match dataset.');
    }
    var vector = dataset.getRowMetadata().add(
      morpheus.Util.getBaseFileName(fileName));
    for (var i = 0; i < assignments.length; i++) {
      vector.setValue(i, assignments[i]);
    }
    if (heatMap) {
      heatMap.getProject().trigger('trackChanged', {
        vectors: [vector],
        display: ['color'],
        columns: isColumns
      });
    }
  },

  annotateSets: function (dataset, isColumns, sets,
                          datasetMetadataName, setSourceFileName) {
    if (isColumns) {
      dataset = morpheus.DatasetUtil.transposedView(dataset);
    }
    var vector = dataset.getRowMetadata().getByName(datasetMetadataName);
    var idToIndices = morpheus.VectorUtil.createValueToIndicesMap(vector);
    var setVector = dataset.getRowMetadata().add(setSourceFileName);
    sets.forEach(function (set) {
      var name = set.name;
      var members = set.ids;
      members.forEach(function (id) {
        var indices = idToIndices.get(id);
        if (indices !== undefined) {
          for (var i = 0, nIndices = indices.length; i < nIndices; i++) {
            var array = setVector.getValue(indices[i]);
            if (array === undefined) {
              array = [];
            }
            array.push(name);
            setVector.setValue(indices[i], array);
          }
        }
      });
    });
    return setVector;
  },
  /**
   *
   * @param lines
   *            Lines of text in annotation file or null if a gmt file
   * @param dataset
   *            Current dataset
   * @param isColumns
   *            Whether annotating columns
   * @param sets
   *            Sets if a gmt file or null
   * @param metadataName
   *            The dataset metadata name to match on
   * @param fileColumnName
   *            The metadata file name to match on
   * @param fileColumnNamesToInclude
   *            An array of column names to include from the metadata file or
   *            null to include all
   * @param tranposed For text/Excel files only. If <code>true</code>, different annotations are on each row.
   */
  annotate: function (lines, dataset, isColumns, sets, metadataName,
                      fileColumnName, fileColumnNamesToInclude, transposed) {
    if (isColumns) {
      dataset = morpheus.DatasetUtil.transposedView(dataset);
    }
    var vector = dataset.getRowMetadata().getByName(metadataName);
    if (!vector) {
      throw new Error('vector ' + metadataName + ' not found.');
    }
    var fileColumnNamesToIncludeSet = null;
    if (fileColumnNamesToInclude) {
      fileColumnNamesToIncludeSet = new morpheus.Set();
      fileColumnNamesToInclude.forEach(function (name) {
        fileColumnNamesToIncludeSet.add(name);
      });
    }
    var vectors = [];
    var idToIndices = morpheus.VectorUtil.createValueToIndicesMap(vector);
    if (!lines) {
      _.each(
        sets,
        function (set) {
          var name = set.name;
          var members = set.ids;

          var v = dataset.getRowMetadata().add(name);
          vectors.push(v);
          _.each(
            members,
            function (id) {
              var indices = idToIndices.get(id);
              if (indices !== undefined) {
                for (var i = 0, nIndices = indices.length; i < nIndices; i++) {
                  v.setValue(
                    indices[i],
                    name);
                }
              }
            });
        });
    } else {
      var tab = /\t/;
      if (!transposed) {
        var header = lines[0].split(tab);
        var fileMatchOnColumnIndex = _.indexOf(header, fileColumnName);
        if (fileMatchOnColumnIndex === -1) {
          throw new Error(fileColumnName + ' not found in header:'
            + header);
        }
        var columnIndices = [];
        var nheaders = header.length;
        for (var j = 0; j < nheaders; j++) {
          var name = header[j];
          if (j === fileMatchOnColumnIndex) {
            continue;
          }
          if (fileColumnNamesToIncludeSet
            && !fileColumnNamesToIncludeSet.has(name)) {
            continue;
          }
          var v = dataset.getRowMetadata().getByName(name);
          if (!v) {
            v = dataset.getRowMetadata().add(name);
          }
          columnIndices.push(j);
          vectors.push(v);
        }
        var nheaders = columnIndices.length;
        for (var i = 1, nrows = lines.length; i < nrows; i++) {
          var line = lines[i].split(tab);
          var id = line[fileMatchOnColumnIndex];
          var indices = idToIndices.get(id);
          if (indices !== undefined) {
            var nIndices = indices.length;
            for (var j = 0; j < nheaders; j++) {
              var token = line[columnIndices[j]];
              var v = vectors[j];
              for (var r = 0; r < nIndices; r++) {
                v.setValue(indices[r], token);
              }
            }
          }
        }
      }
      else {
        // transposed
        var splitLines = [];
        var matchOnLine;
        for (var i = 0, nrows = lines.length; i < nrows; i++) {
          var line = lines[i].split(tab);
          var name = line[0];
          if (fileColumnName === name) {
            matchOnLine = line;
          } else {
            if (fileColumnNamesToIncludeSet
              && !fileColumnNamesToIncludeSet.has(name)) {
              continue;
            }
            splitLines.push(line);
            var v = dataset.getRowMetadata().getByName(name);
            if (!v) {
              v = dataset.getRowMetadata().add(name);
            }
            vectors.push(v);
          }
        }
        if (matchOnLine == null) {
          throw new Error(fileColumnName + ' not found in header.');
        }

        for (var fileColumnIndex = 1, ncols = matchOnLine.length; fileColumnIndex < ncols; fileColumnIndex++) {
          var id = matchOnLine[fileColumnIndex];
          var indices = idToIndices.get(id);
          if (indices !== undefined) {
            var nIndices = indices.length;
            for (var j = 0; j < splitLines.length; j++) {
              var token = splitLines[j][fileColumnIndex];
              var v = vectors[j];
              for (var r = 0; r < nIndices; r++) {
                v.setValue(indices[r], token);
              }
            }
          }

        }
      }
    }
    for (var i = 0; i < vectors.length; i++) {
      morpheus.VectorUtil.maybeConvertStringToNumber(vectors[i]);
    }
    return vectors;
  },
  // prompt for metadata field name in dataset
  promptSets: function (dataset, heatMap, isColumns, sets, setSourceFileName) {
    var promptTool = {};
    var _this = this;
    promptTool.execute = function (options) {
      var metadataName = options.input.dataset_field_name;
      var vector = _this.annotateSets(dataset, isColumns, sets,
        metadataName, setSourceFileName);

      heatMap.getProject().trigger('trackChanged', {
        vectors: [vector],
        display: ['text'],
        columns: isColumns
      });
    };
    promptTool.toString = function () {
      return 'Select Fields To Match On';
    };
    promptTool.gui = function () {
      return [
        {
          name: 'dataset_field_name',
          options: morpheus.MetadataUtil.getMetadataNames(
            isColumns ? dataset.getColumnMetadata() : dataset.getRowMetadata()),
          type: 'select',
          value: 'id',
          required: true
        }];

    };
    morpheus.HeatMap.showTool(promptTool, heatMap);

  },
  prompt: function (lines, dataset, heatMap, isColumns) {
    var promptTool = {};
    var _this = this;
    var header = lines != null ? lines[0].split('\t') : null;
    promptTool.execute = function (options) {
      var metadataName = options.input.dataset_field_name;
      var fileColumnName = options.input.file_field_name;
      var vectors = _this.annotate(lines, dataset, isColumns, null,
        metadataName, fileColumnName);

      var nameToIndex = new morpheus.Map();
      var display = [];
      for (var i = 0; i < vectors.length; i++) {
        display.push(isColumns ? 'color' : 'text');
        nameToIndex.set(vectors[i].getName(), i);
      }
      if (lines.colors) {
        var colorModel = isColumns
          ? heatMap.getProject().getColumnColorModel()
          : heatMap.getProject().getRowColorModel();
        lines.colors.forEach(function (item) {
          var index = nameToIndex.get(item.header);
          var vector = vectors[index];
          display[index] = 'color';
          colorModel.setMappedValue(vector, item.value, item.color);
        });
      }
      heatMap.getProject().trigger('trackChanged', {
        vectors: vectors,
        display: display,
        columns: isColumns
      });
    };
    promptTool.toString = function () {
      return 'Select Fields To Match On';
    };
    promptTool.gui = function () {
      var items = [
        {
          name: 'dataset_field_name',
          options: morpheus.MetadataUtil.getMetadataNames(
            isColumns ? dataset.getColumnMetadata() : dataset.getRowMetadata()),
          type: 'select',
          required: true
        }];
      if (lines) {
        items.push({
          name: 'file_field_name',
          type: 'select',
          options: _.map(header, function (item) {
            return {
              name: item,
              value: item
            };
          }),
          required: true
        });
      }
      return items;
    };
    morpheus.HeatMap.showTool(promptTool, heatMap);
  }
};
