export const validateProduct = (form) => {
  const errors = {}

  if (!form.name || form.name.trim().length < 2)
    errors.name = 'Le nom doit avoir au moins 2 caractères'

  if (!form.price_sell || parseFloat(form.price_sell) <= 0)
    errors.price_sell = 'Le prix de vente doit être supérieur à 0'

  if (form.price_buy && parseFloat(form.price_buy) < 0)
    errors.price_buy = "Le prix d'achat ne peut pas être négatif"

  if (!form.quantity || parseInt(form.quantity) < 0)
    errors.quantity = 'La quantité ne peut pas être négative'

  if (form.alert_threshold && parseInt(form.alert_threshold) < 0)
    errors.alert_threshold = 'Le seuil d\'alerte ne peut pas être négatif'

  return errors
}

export const validateClient = (form) => {
  const errors = {}

  if (!form.name || form.name.trim().length < 2)
    errors.name = 'Le nom doit avoir au moins 2 caractères'

  if (form.phone) {
    const clean = form.phone.replace(/\s/g, '').replace('+243', '0').replace('+', '')
    
    // Doit être exactement 10 chiffres
    if (!/^\d{10}$/.test(clean)) {
      errors.phone = 'Le numéro doit avoir 10 chiffres (ex: 0891234567)'
    }
    // Doit commencer par 08 ou 09 ou 07
    else if (!/^0(7|8|9)\d{8}$/.test(clean)) {
      errors.phone = 'Numéro invalide — doit commencer par 08x, 09x ou 07x'
    }
  }

  return errors
}

export const validateExpense = (form) => {
  const errors = {}

  if (!form.amount || parseFloat(form.amount) <= 0)
    errors.amount = 'Le montant doit être supérieur à 0'

  return errors
}

export const validateSale = (form) => {
  const errors = {}

  if (!form.product)
    errors.product = 'Sélectionne un produit'

  if (!form.quantity || parseInt(form.quantity) <= 0)
    errors.quantity = 'La quantité doit être supérieure à 0'

  if (form.quantity > form.product?.quantity)
    errors.quantity = `Stock insuffisant — ${form.product?.quantity} unités disponibles`

  return errors
}

export const validateDebt = (form) => {
  const errors = {}

  if (!form.amount || parseFloat(form.amount) <= 0)
    errors.amount = 'Le montant doit être supérieur à 0'

  return errors
}

export const sanitize = (str) => {
  if (typeof str !== 'string') return str
  return str.trim().slice(0, 500)
}