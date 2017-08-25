export async function createOrUpdate(model, where, values) {
  const [result, created] = await model.findOrCreate({where, defaults: values})
  if (!created) {
    await model.update(values, {where})
  }
  return {created}
}
