import utils, { hooks } from '@bigcommerce/stencil-utils';
import CatalogPage from './catalog';
import compareProducts from './global/compare-products';
import FacetedSearch from './common/faceted-search';
import { createTranslationDictionary } from '../theme/common/utils/translations-utils';
import { normalizeFormData } from '../theme/common/utils/api';

import { showAlertModal } from './global/modal';

export default class Category extends CatalogPage {
    constructor(context) {
        super(context);
        this.validationDictionary = createTranslationDictionary(context);
        this.addItemToCart = this.addItemToCart.bind(this);
        this.removeItemFromCart = this.removeItemFromCart.bind(this);
        this.addAllToCart = this.addAllToCart.bind(this);
        this.removeAllFromCart = this.removeAllFromCart.bind(this);
        this.confirmRemoveAllFromCart = this.confirmRemoveAllFromCart.bind(this);
        this.getCartItemIds = this.getCartItemIds.bind(this);
    }

    setLiveRegionAttributes($element, roleType, ariaLiveStatus) {
        $element.attr({
            role: roleType,
            'aria-live': ariaLiveStatus,
        });
    }

    makeShopByPriceFilterAccessible() {
        if (!$('[data-shop-by-price]').length) return;

        if ($('.navList-action').hasClass('is-active')) {
            $('a.navList-action.is-active').trigger('focus');
        }

        $('a.navList-action').on('click', () => this.setLiveRegionAttributes($('span.price-filter-message'), 'status', 'assertive'));
    }

    onReady() {
        this.arrangeFocusOnSortBy();

        $('[data-button-type="add-cart"]').on('click', (e) => this.setLiveRegionAttributes($(e.currentTarget).next(), 'status', 'polite'));

        this.makeShopByPriceFilterAccessible();

        compareProducts(this.context);

        this.initFacetedSearch();

        if (!$('#facetedSearch').length) {
            this.onSortBySubmit = this.onSortBySubmit.bind(this);
            hooks.on('sortBy-submitted', this.onSortBySubmit);

            // Refresh range view when shop-by-price enabled
            const urlParams = new URLSearchParams(window.location.search);

            if (urlParams.has('search_query')) {
                $('.reset-filters').show();
            }

            $('input[name="price_min"]').attr('value', urlParams.get('price_min'));
            $('input[name="price_max"]').attr('value', urlParams.get('price_max'));
        }

        $('a.reset-btn').on('click', () => this.setLiveRegionsAttributes($('span.reset-message'), 'status', 'polite'));

        this.ariaNotifyNoProducts();

        $('#add-all-to-cart').on('click', this.addAllToCart);
        $('#remove-all-from-cart').on('click', this.confirmRemoveAllFromCart);
    }

    ariaNotifyNoProducts() {
        const $noProductsMessage = $('[data-no-products-notification]');
        if ($noProductsMessage.length) {
            $noProductsMessage.trigger('focus');
        }
    }

    initFacetedSearch() {
        const {
            price_min_evaluation: onMinPriceError,
            price_max_evaluation: onMaxPriceError,
            price_min_not_entered: minPriceNotEntered,
            price_max_not_entered: maxPriceNotEntered,
            price_invalid_value: onInvalidPrice,
        } = this.validationDictionary;
        const $productListingContainer = $('#product-listing-container');
        const $facetedSearchContainer = $('#faceted-search-container');
        const productsPerPage = this.context.categoryProductsPerPage;
        const requestOptions = {
            config: {
                category: {
                    products: {
                        limit: productsPerPage,
                    },
                },
            },
            template: {
                productListing: 'category/product-listing',
                sidebar: 'category/sidebar',
            },
            showMore: 'category/show-more',
        };

        this.facetedSearch = new FacetedSearch(requestOptions, (content) => {
            $productListingContainer.html(content.productListing);
            $facetedSearchContainer.html(content.sidebar);

            $('body').triggerHandler('compareReset');

            $('html, body').animate({
                scrollTop: 0,
            }, 100);
        }, {
            validationErrorMessages: {
                onMinPriceError,
                onMaxPriceError,
                minPriceNotEntered,
                maxPriceNotEntered,
                onInvalidPrice,
            },
        });
    }

    getNameById(id) {
        return new Promise((resolve, reject) => {
            utils.api.product.getById(id, { template: 'category/product-name' }, (err, response) => {
                if (err) return reject(err);
                return resolve(response);
            });
        });
    }

    addItemToCart(productId) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('product_id', productId);
            formData.append('qty[]', 1);

            utils.api.cart.itemAdd(normalizeFormData(formData), (err, response) => {
                if (err) {
                    return reject(err);
                }
                return resolve({ productId, response });
            });
        });
    }

    addAllToCart(e) {
        e.preventDefault();

        const $body = $('body');
        const $button = $('#add-all-to-cart');
        $button.prop('disabled', true).text('Adding...');

        const productIds = $('[data-entity-id]').map((_, el) => $(el).data('entity-id')).get();

        utils.api.cart.getCartQuantity({}, (error, cartQty) => {
            if (error) {
                console.error('Error getting cart quantity:', error);
                $button.prop('disabled', true).text('Add All to Cart');
                return;
            }

            let chain = Promise.resolve();
            const errors = [];

            productIds.forEach((id) => {
                chain = chain.then(() => {
                    return this.addItemToCart(id).then(({ productId, response }) => {
                        if (response.data.error) {
                            errors.push({ productId, error: response.data.error });
                        }
                    });
                });
            });

            chain
                .then(() => {
                    if (errors.length) {
                        let errStr = '';
                        let nameChain = Promise.resolve();
                        errors.forEach(({ productId, error }) => {
                            // want to get the product names and errors in the alert modal – there's probably a cleaner way to do this
                            nameChain = nameChain.then(() => {
                                return this.getNameById(productId).then((response) => {
                                    errStr += `${response}:<br/><span class='errorText'>${error}</span></li>`;
                                });
                            });
                        });

                        nameChain.then(() => {
                            showAlertModal(`<p>${errors.length} item${errors.length === 1 ? `` : 's'} could not be added to the cart:</p><ul class='errorList'>${errStr}</ul>`, {
                                icon: 'warning',
                            });
                            $body.trigger('cart-quantity-update', cartQty + productIds.length - errors.length);
                            $button.prop('disabled', false).text('Add All to Cart');
                        });
                    } else {
                        showAlertModal('All items have been added to the cart.', {
                            icon: 'success',
                        });
                        $body.trigger('cart-quantity-update', cartQty + productIds.length);
                        $button.prop('disabled', false).text('Add All to Cart');
                    }
                })
                .catch((err) => {
                    console.error('Error adding items to cart:', err);
                    showAlertModal('Some items could not be added to the cart. Please try again.', {
                        icon: 'error',
                    });
                    $button.prop('disabled', false).text('Add All to Cart');
                });
        });
    }

    getCartItemIds(cart) {
        const itemIdArr = [];
        if (
            !cart.lineItems.physicalItems.length ||
            !cart.lineItems.digitalItems.length ||
            !cart.lineItems.customItems.length ||
            !cart.lineItems.giftCertificates.length
        ) {
            Object.keys(cart.lineItems).forEach((key) => {
                cart.lineItems[key].forEach((item) => {
                    itemIdArr.push(item.id);
                });
            });
            return itemIdArr;
        }
        console.error('Error getting cart item ids')
        return itemIdArr;
    }

    removeItemFromCart(itemId) {
        return new Promise((resolve, reject) => {
            utils.api.cart.itemRemove(itemId, (err, response) => {
                if (err) return reject(err);
                return resolve(response);
            });
        });
    }

    removeAllFromCart() {
        const $body = $('body');
        const $button = $('#remove-all-from-cart');
        $button.prop('disabled', true).text('Emptying cart...');

        utils.api.cart.getCart({}, (error, response) => {
            if (error) {
                showAlertModal('There was a problem removing all items from your cart.', {
                    icon: 'error',
                });
                return;
            }

            const itemIds = this.getCartItemIds(response);
            if (!itemIds) return;

            let chain = Promise.resolve();

            itemIds.forEach((itemId) => {
                chain = chain.then(() => this.removeItemFromCart(itemId));
            });

            chain
                .then(() => {
                    showAlertModal('All items have been removed from your cart.', {
                        icon: 'success',
                    });
                    $body.trigger('cart-quantity-update', 0);
                    $button.prop('disabled', false).text('Remove All Items');
                })
                .catch((err) => {
                    console.error('Error removing items from cart:', err);
                    showAlertModal('Some items could not be removed from the cart. Please try again.', {
                        icon: 'error',
                    });
                });
        });
    }

    confirmRemoveAllFromCart(e) {
        e.preventDefault();
        showAlertModal('Are you sure you want to remove all items from your cart?', {
            icon: 'warning',
            showCancelButton: true,
            onConfirm: this.removeAllFromCart,
        });
    }
}
