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

        $('#add-all-to-cart').on('click', this.handleAddAllToCart);
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

    handleAddAllToCart() {
        const $body = $('body');
        const $button = $('#add-all-to-cart');
        $button.prop('disabled', true).text('Adding...');

        const productIds = $('[data-entity-id]').map((_, el) => $(el).data('entity-id')).get();

        utils.api.cart.getCartQuantity({}, (error, cartQty) => {
            if (!error) {
                const addItems = productIds.map((id) => {
                    return new Promise((resolve, reject) => {
                        const formData = new FormData();
                        formData.append('product_id', id);
                        formData.append('qty[]', 1);
                        utils.api.cart.itemAdd(normalizeFormData(formData), err => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });

                Promise.all(addItems)
                    .catch((err) => {
                        console.error('Error adding items to cart', err);
                        showAlertModal('Some items could not be added to the cart. Please try again.', {
                            icon: 'error',
                        });
                    })
                    .finally(() => {
                        $button.prop('disabled', false).text('Add All to Cart');
                        $body.trigger('cart-quantity-update', cartQty + productIds.length);
                        showAlertModal('All items have been added to the cart.', {
                            icon: 'success',
                        });
                    });
            } else {
                console.error('Error getting cart quantity', error);
                $button.prop('disabled', true).text('Add All to Cart');
            }
        });
    }
}
