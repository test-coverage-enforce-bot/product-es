var asset = {};
(function(asset, core) {
    function AssetManager(registry, type, ctx) {
        this.registry = registry;
        this.type = type;
    }
    AssetManager.prototype.init = function() {};
    AssetManager.prototype.create = function(options) {};
    AssetManager.prototype.update = function(options) {};
    AssetManager.prototype.remove = function(options) {};
    AssetManager.prototype.search = function(options) {};
    AssetManager.prototype.invokeAction = function(options) {};
    AssetManager.prototype.createVersion = function(options, newVersion) {};

    function AssetRenderer(rxtManager, type) {
        this.rxtManager = rxtManager;
        this.type = type;
    }
    AssetRenderer.prototype.create = function(asset) {};
    AssetRenderer.prototype.update = function(asset) {};
    AssetRenderer.prototype.listAsset = function(asset) {};
    AssetRenderer.prototype.listAssets = function(assets) {};
    AssetRenderer.prototype.leftNav = function(asset) {};
    /**
     * The function create an asset manage given a registry instance,type and tenantId
     * @param  {[type]} tenantId The id of the tenant
     * @param  {[type]} registry The registry instance used to create the underlying artifact manager
     * @param  {[type]} type     The type of the assets managed by the asset manager
     * @return An asset manager instance
     */
    var createAssetManager = function(tenantId, registry, type) {
        var reflection = require('utils').reflection;
        var assetManager = new AssetManager(registry, type);
        var assetResourcesTemplate = core.assetResources(tenantId, type);
        var context = core.createAssetContext(tenantId, type);
        var assetResources = assetResourcesTemplate.manager ? assetResourcesTemplate.manager(context) : {};
        reflection.override(assetManager, assetResources);
        return assetManager;
    };
    var createRenderer = function(session, type) {
        var reflection = require('utils').reflection;
        var context = core.createAssetContext(session, type);
        var assetResources = core.assetResources(context.tenantId, type);
        context.endpoints = asset.getAssetEndpoints(session, type);
        var customRenderer = (assetResources.renderer) ? assetResources.renderer(context) : {};
        var rxtManager = core.rxtManager(context.tenantId);
        var renderer = new AssetRenderer(rxtManager, type);
        reflection.override(renderer, customRenderer);
    };
    /**
     * The function will create an Asset Manager instance using the registry of the currently
     * logged in user
     * @return An Asset Manager instance which will store assets in the currently logged in users registry
     */
    asset.createUserAssetManager = function(session, type) {
        var server = require('store').server;
        var user = require('store').user;
        var userDetails = server.current(session);
        var userRegistry = user.userRegistry(session);
        return createAssetManager(userDetails.tenantId, userRegistry, type);
    };
    /**
     * The function will create an Asset Manager using the system registry of the provided tenant
     * @return An Asset Manager
     */
    asset.createSystemAssetManager = function(tenantId, type) {
        var server = require('store').server;
        var sysRegistry = server.systemRegistry(tenantId);
        return createAssetManager(tenantId, sysRegistry, type);
    };
    asset.createRenderer = function(session, type) {
        return createRenderer(session, type);
    };
    /**
     * The function obtains a list of all endpoints available to currently
     * logged in user for the provided asset type
     * @param  {[type]} session [description]
     * @param  {[type]} type    [description]
     * @return {[type]}         [description]
     */
    asset.getAssetEndpoints = function(session, type) {
        var context = core.createAssetContext(session, type);
        var assetResources = core.assetResources(context.tenantId, type);
        return assetResources.server ? assetResources.server(context).endpoints : {};
    };
    asset.getAssetApiEndpoints = function(session, type) {
        var endpoints = this.getAssetEndpoints(session, type);
        return endpoints['apis'] || [];
    };
    asset.getAssetPageEndpoints = function(session, type) {
        var endpoints = this.getAssetEndpoints(session, type);
        return endpoints['pages'] || [];
    };
    asset.getAssetExtensionPath = function(type) {
        return '/extensions/assets/' + type;
    };
    asset.getAssetDefaultPath = function() {
        return '/extensions/assets/default';
    };
    asset.getAssetApiDirPath = function(type) {
        return asset.getAssetExtensionPath(type) + '/apis';
    };
    asset.getAssetPageDirPath = function(type) {
        return asset.getAssetExtensionPath(type) + '/pages';
    };
    asset.getAssetApiEndpoint = function(type, endpointName) {
        //Check if the path exists within the asset extension path
        var endpointPath = asset.getAssetApiDirPath(type) + '/' + endpointName;
        var endpoint = new File(endpointPath);
        if (!endpoint.isExists()) {
            endpointPath = asset.getAssetDefaultPath() + '/apis/' + endpointName;
            endpoint = new File(endpointPath);
            if (!endpoint.isExists()) {
                endpointPath = '';
            }
        }
        return endpointPath;
    };
    asset.getAssetPageEndpoint = function(type, endpointName) {
        //Check if the path exists within the asset extension path
        var endpointPath = asset.getAssetPageDirPath(type) + '/' + endpointName;
        var endpoint = new File(endpointPath);
        if (!endpoint.isExists()) {
            endpointPath = asset.getAssetDefaultPath() + '/pages/' + endpointName;
            endpoint = new File(endpointPath);
            if (!endpoint.isExists()) {
                endpointPath = '';
            }
        }
        return endpointPath;
    };
    asset.resolve = function(request, path,themeName,themeObj,themeResolver) {
        var log = new Log();
        log.info('Path: ' + path);
        log.info('Request: ' + request.getRequestURI());
        var resPath=path;
        path = '/' + path;
        //Determine the type of the asset
        var uriMatcher = new URIMatcher(request.getRequestURI());
        var extensionMatcher = new URIMatcher(path);
        var uriPattern = '/{context}/asts/{type}/{+options}';
        var extensionPattern = '/{root}/extensions/assets/{type}/{+suffix}';
        uriMatcher.match(uriPattern);
        extensionMatcher.match(extensionPattern);
        var pathOptions = extensionMatcher.elements()||{};
        var uriOptions = uriMatcher.elements()||{};


        log.info('URI details: ' + stringify(uriMatcher.elements()));
        log.info('Extension details: ' + stringify(extensionMatcher.elements()));

        //If the type is not metioned then return the path
        if(!pathOptions.type){

            //Determine if the paths occur within the extensions directory
            var extensionResPath='/extensions/assets/'+uriOptions.type+'/themes/'+themeName+'/'+resPath;
            var resFile=new File(extensionResPath);
            log.info('Checking if resource exists: '+extensionResPath);

            if(resFile.isExists()){
                return extensionResPath;
            }

            log.info('Resource not present in extensions directory, using : ' +themeResolver.call(themeObj,path));
            return themeResolver.call(themeObj,path);
        }

        //Check if type has a similar path in its extension directory
        var extensionPath='/extensions/assets/'+uriOptions.type+'/themes/'+themeName+'/'+pathOptions.root+'/'+pathOptions.suffix;
        var file=new File(extensionPath);
        log.info('Extension path: '+extensionPath);
        if(file.isExists()){
            log.info('Final path: '+extensionPath);
            return extensionPath;
        }
        
        //If an extension directory does not exist then use theme directory
        extensionPath=pathOptions.root+'/'+pathOptions.suffix;
        var modPath=themeResolver.call(themeObj,extensionPath);
        log.info('Final path: '+extensionPath);
        log.info('Mod path: '+modPath);
        return modPath;
    };
}(asset, core))