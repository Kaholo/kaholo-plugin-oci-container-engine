const { getContainerEngineClient, parseMultiAutoComplete } = require('./helpers');
const parsers = require("./parsers");

async function createNodePool(action, settings) {
  const client = getContainerEngineClient(settings);
  const nsgIds = parseMultiAutoComplete(action.params.nsg);
  const availabilityDomains = parseMultiAutoComplete(action.params.availabilityDomains);
  const subnets = parseMultiAutoComplete(action.params.subnets);
  if (!availabilityDomains || !subnets || availabilityDomains.length == 0 || subnets.length == 0) {
    throw "Must provide at least one subnet and one availability domain";
  }
  if (availabilityDomains.length !== subnets.length){
    throw "Must provide exactly one subnet from each availability domain";
  } 
  
  return client.createNodePool({ createNodePoolDetails: {
    compartmentId: parsers.autocomplete(action.params.compartment) || settings.tenancyId,
    name: parsers.string(action.params.name),
    clusterId: parsers.autocomplete(action.params.cluster),
    kubernetesVersion: action.params.kubernetesVersion || "1.19.7",
    nodeShape: parsers.autocomplete(action.params.shape),
    nodeImageName: parsers.autocomplete(action.params.image),
    nodeConfigDetails: {
      size: parsers.number(action.params.nodeCount),
      nsgIds: nsgIds,
      placementConfigs: subnets.map((subnetId, index) => ({
        availabilityDomain: availabilityDomains[index],
        subnetId: subnetId
      }))
    },
    nodeShapeConfig: !action.params.ocpuCount || !action.params.memSize ? undefined : {
      memoryInGBs: parsers.number(action.params.memSize),
      ocpus: parsers.number(action.params.ocpuCount)
    }
  }});
}

async function createCluster(action, settings) {
  const client = getContainerEngineClient(settings);
  const result = {createCluster: await client.createCluster({ createClusterDetails: {
    compartmentId: parsers.autocomplete(action.params.compartment) || settings.tenancyId,
    name: parsers.string(action.params.name),
    kubernetesVersion: action.params.kubernetesVersion || "1.19.7",
    vcnId: parsers.autocomplete(action.params.vcn),
    endpointConfig: {
      isPublicIpEnabled: parsers.boolean(action.params.publicIp),
      nsgIds: parseMultiAutoComplete(action.params.nsg),
      subnetId: parsers.autocomplete(action.params.subnet),
    },
    options: {
      serviceLbSubnetIds: parsers.array(lbSubnetIds),
      kubernetesNetworkConfig: {
        podsCidr: parsers.string(action.params.podsCidr),
        servicesCidr: parsers.string(action.params.servicesCidr)
      }
    }
  }})};
  try {
    if (action.params.shape){ // if specified shape then need to create node pool
      action.params.name = action.params.name + "_nodepool";
      result.createNodePool = await createNodePool(action, settings);
    }
  }
  catch (error){
    throw {...result, error};
  }
  return result;
}

async function createClusterKubeConfig(action, settings) {
  const client = getContainerEngineClient(settings);
  return client.createKubeconfig({ 
    clusterId: parsers.autocomplete(action.params.cluster),
    createClusterKubeconfigContentDetails: {
      endpoint: action.params.endpointType,
      tokenVersion: "2.0.0"
    }
  });
}

module.exports = {
  createNodePool,
  createCluster,
  createClusterKubeConfig,
  ...require("./autocomplete")
}
