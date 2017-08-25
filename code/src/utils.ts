export function stringToBoolean(arg:string){
  if (arg!='true' && arg!='false'){
    throw('argument not a valid boolean value')
  }
  return arg=='true'
}
