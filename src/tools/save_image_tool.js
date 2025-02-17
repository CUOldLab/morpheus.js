morpheus.SaveImageTool = function () {

};
morpheus.SaveImageTool.prototype = {

  toString: function () {
    return 'Save Image';
  },
  init: function (project, form) {
    form.find('file_name').prop('autofocus', true).focus();
  },
  gui: function () {
    return [{
      name: 'file_name',
      type: 'text',
      required: true
    }, {
      name: 'format',
      type: 'radio',
      options: ['PNG', 'SVG'],
      value: 'PNG',
      required: true
    }];
  },
  execute: function (options) {
    var fileName = options.input.file_name;
    if (fileName === '') {
      fileName = 'image';
    }
    var format = options.input.format.toLowerCase();
    if (!morpheus.Util.endsWith(fileName.toLowerCase(), '.' + format)) {
      fileName += '.' + format;
    }
    var heatMap = options.heatMap;
    heatMap.saveImage(fileName, format);
  }
};
