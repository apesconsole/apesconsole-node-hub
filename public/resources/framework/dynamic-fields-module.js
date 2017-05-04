angular.module('dynamic-fields', [])
  .factory('RemoteDataService', ['$http', function ($http) {
		return {
			loadRemoteData: function(handler) {
				$http({
					url: handler.service,
					method: 'GET',
					params: handler.params
				})
				.then(function (result) {
					handler.callBack(result.data);
				});
			},
			decoratelist: function(list, values){
				var _t = '',
				util = {
					select: function(opt, values){
						if(null != values && values.length > 0) opt.defaultSelect = false;
						var decide = false;
						angular.forEach(values, function(val, key) {
							if(opt.value == val && !decide) {
								decide = true;
							}
						});
						return decide ? decide : opt.defaultSelect;
					}
				};
				angular.forEach(list, function(opt, key) {
					_t+='<option value="' + opt.value + '" ' + (util.select(opt, values) ? ' selected="selected"' : '') + '>' + opt.text + '</option>';
				}); return _t;
			}
		}
  }])
  .directive('remoteoption', function($compile, RemoteDataService){
		return {
		  restrict: 'A',
		     scope: {
				remoteoption: '=',
				model: '='
			},	
		   compile: function(element, attrs) {
				return function(scope, element, attrs) {
					angular.forEach(scope.remoteoption, function(map, key) {
						if(map.key == attrs.id) {
							var proceed = true;
							if(undefined != map.field.parent && null != map.field.parent){
								proceed = null != scope.model[map.field.parent];								
								if(proceed) map.field.options.remote_data_set.params.forKey = scope.model[map.field.parent];
							} 
							if(proceed)
							RemoteDataService.loadRemoteData({
								 service: map.field.options.remote_data_set.service,
								  params: map.field.options.remote_data_set.params,
								callBack: function(data){
									var htm = RemoteDataService.decoratelist(data, map.field.options.value);
									element.html(htm);
									$compile(element.contents())(scope);
									scope.model[map.field.model] = null != map.field.options.value ? map.field.options.value[0] : '';
								}
							});return;
						}
					});
				};
		   }
		}		
  }) 
  .directive('dynamiccontent', function($compile, RemoteDataService){
		var _map = [],
		register = function(key, data){
			_map[_map.length] = {key: key, field: data};
		},
		getTemplate = function(field, _model) {
			_model[field.model] = '';
			var _template = '';
			_template+= '<li><span class="' + field.label.css + '">' + field.label.text + '</span></li>';
			_template+= '<li><' + field.field + ' ';
			angular.forEach(field.attributes, function(attr, attrkey) {
				_template+=' ' + attr.name + '="' + attr.value + '" ';
				if(attr.name == 'value') _model[field.model] = attr.value;
			});			
			//alert(JSON.stringify(_model));
			switch(field.field){
				case 'input':		
					_template+= '>';
					break;		
				case 'textarea':
					_template+= '>' + field.value + '</' + field.field + '>';
					_model[field.model] = field.value;
					break;	
				case 'select':
					_model[field.model] = field.options.value;
					
					if(null != field.options.remote_data_set){
						_template+=' remoteoption="remoteoption"  model="passmodel" ';
						register(field.id, field);
					}
					_template+= '>';
					if(null != field.options.local_data_set){
						_template+= RemoteDataService.decoratelist(field.options.local_data_set, field.options.value);
					}
			}	
			_template+= '</li>';
			return _template;
		};
		return {
		   replace: true,
			 scope: {
				fielddata: '=',
				model: '='
			 },
	    controller: ['$scope', function($scope) {
				$scope.remoteoption = _map;
				$scope.passmodel = $scope.model;	
		   }],		 
		   compile: function(element, attrs) {
				return function(scope, element, attrs) {
					var tmpl = getTemplate(scope.fielddata, scope.model);
					element.html(tmpl);
					$compile(element.contents())(scope);
				};
		   }
		}
  })
  .directive('dynamicsection', function(){
		var controller = ['$scope', function($scope) {
			$scope.fieldList = $scope.datasource;
			$scope.inputmodel = $scope.model;
		}];
		return {
			 scope: {
				datasource: '=',
				model: '='
			 },
		controller: controller,			 
		  template: '<fieldset><ul><dynamiccontent ng-repeat="eachField in fieldList" fielddata="eachField" model="inputmodel"></dynamiccontent></ul></fieldset>'
		}
  });