export function stringToBoolean(arg : string | boolean){
  if (typeof arg === 'boolean') {
    return true
  }
  if (arg !== 'true' && arg !== 'false'){
    throw 'argument not a valid boolean value'
  }
  return arg == 'true'
}
