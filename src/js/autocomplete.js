/**
 * --------------------------------------------------------------------------
 * Bootstrap Autocomplete (v0.2.0): autocomplete.js
 * Licensed under MIT (https://github.com/iqbalfn/bootstrap-autocomplete/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

import $ from 'jquery'
import Util from './util'

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME               = 'autocomplete'
const VERSION            = '0.2.0'
const DATA_KEY           = 'bs.autocomplete'
const EVENT_KEY          = `.${DATA_KEY}`
const DATA_API_KEY       = '.data-api'
const JQUERY_NO_CONFLICT = $.fn[NAME]

const Default = {
    list            : null,

    prefetch        : null,

    filter          : null,
    filterDelay     : 300,
    filterMinChars  : 1,
    filterRelation  : null,

    maxResult       : 10,

    onPick          : null,
    onItemRendered  : null,

    preProcess      : null
}

const DefaultType = {
    list            : '(null|string|element)',

    prefetch        : '(null|string)',

    filter          : '(null|string)',
    filterDelay     : 'number',
    filterMinChars  : 'number',
    filterRelation  : '(null|object)',

    maxResult       : 'number',

    preProcess      : '(null|function)',

    onPick          : '(null|function)',
    onItemRendered  : '(null|function)'
}

const Event = {
    BLUR_DATA_API       : `blur${EVENT_KEY}${DATA_API_KEY}`,
    CLICK_DATA_API      : `click${EVENT_KEY}${DATA_API_KEY}`,
    KEYDOWN_DATA_API    : `keydown${EVENT_KEY}${DATA_API_KEY}`,
    INPUT_DATA_API      : `input${EVENT_KEY}${DATA_API_KEY}`,

    PICK                : `pick${EVENT_KEY}`,
    ITEM_RENDER         : `itemrender${EVENT_KEY}`
}

const ClassName = {
    DROPDOWN_MENU : 'dropdown-menu',
    DROPDOWN_ITEM : 'dropdown-item'
}

const KeyCode = {
    ARROW_DOWN  : 40,
    ARROW_UP    : 38,
    ENTER       : 13,
    ESCAPE      : 27
}

const Selector = {}

/**
 * ------------------------------------------------------------------------
 * Class Definition
 * ------------------------------------------------------------------------
 */

class Autocomplete {
    constructor(element, config) {
        this._config    = this._getConfig(config)
        this._element   = element

        this._items     = []
        this._labels    = {}

        this._isShown   = false
        this._dropdown  = null
        this._spinner   = null
        this._result    = []
        this._query     = ''
        this._preventClose = false
        this._timer     = null
        this._relations = null

        if(element.hasAttribute('list')){
            this._config.list = '#' + element.getAttribute('list')
            element.removeAttribute('list')
        }

        if(!this._config.list && !this._config.prefetch && !this._config.filter)
            throw new TypeError('No data source provided')

        if(this._config.filterRelation)
            this._handleRelations()

        element.setAttribute('autocomplete', 'off')

        this._makeDropdown()
        this._makeSpinner()
        this._fetchPresetData()
        this._addElementListener()
    }

    // Getters

    static get VERSION() {
        return VERSION
    }

    static get Default() {
        return Default
    }

    // Public

    show(){
        if(this._isShown)
            return

        if(this._result.length)
            this._showDropdown()
    }

    hide(){
        if(!this._isShown)
            return

        this._hideDropdown()
    }

    dispose() {
        $(this._element).off(EVENT_KEY)

        $.removeData(this._element, DATA_KEY)

        this._config    = null
        this._element   = null
        this._items     = null
        this._labels    = null
        this._isShown   = null
        this._dropdown  = null
        this._spinner   = null
        this._result    = null
        this._query     = null
        this._preventClose = null
        if(this._timer)
            clearTimeout(this._timer)
        this._timer     = null
    }

    // Private

    _addElementListener(){
        $(this._element).on(Event.KEYDOWN_DATA_API, e => {
            let prevent = false

            switch(e.keyCode){
                case KeyCode.ARROW_DOWN:
                    if(e.altKey && !this._isShown){
                        this._query = this._element.value.trim().toLowerCase()

                        if(this._query){
                            this._findFromList()
                            prevent = true
                        }
                    }else{
                        this._focusNext()
                        prevent = true
                    }
                    break;

                case KeyCode.ARROW_UP:
                    this._focusPrev()
                    prevent = true
                    break;

                case KeyCode.ENTER:
                    if(this._isShown){
                        let item = $(this._dropdown).children('.active').get(0)
                        if(!item)
                            item = $(this._dropdown).children(':first-child').get(0)

                        if(item)
                            this._selectItem(item)

                        this.hide()
                        prevent = true
                    }
                    break;

                case KeyCode.ESCAPE:
                    prevent = true
                    this.hide()
                    break;
            }

            if(prevent)
                e.preventDefault()
        })

        $(this._element).on(Event.INPUT_DATA_API, e => {
            this._query = this._element.value.trim().toLowerCase()

            if(!this._query){
                this._truncateDropdown()
                this.hide()
            }else{
                this._findFromList()
            }
        })

        $(this._element).on(Event.BLUR_DATA_API, e => {
            if(this._preventClose)
                return
            setTimeout(() => this.hide(), 150)
        })
    }

    _fetchPresetData(){
        // from datalist
        if(this._config.list){
            let dataList = this._config.list
            if(typeof dataList === 'string')
                dataList = document.querySelector(this._config.list)

            if(dataList){
                Array.from(dataList.children).forEach(o => {
                    let val = o.innerHTML.toLowerCase()
                    if(this._items.includes(val))
                        return

                    this._items.push(val)
                    this._labels[val] = o.innerHTML
                })
            }
        }

        // from prefetch
        if(this._config.prefetch){
            this._showSpinner()
            $.get(this._config.prefetch, res => {
                this._hideSpinner()
                if(this._config.preProcess)
                    res = this._config.preProcess(res)

                res.forEach(i => {
                    let val = i.toLowerCase()
                    if(this._items.includes(val))
                        return
                    this._items.push(val)
                    this._labels[val] = i
                })
            })
        }
    }

    _findFromAjax(){
        if(!this._config.filter)
            return
        if(this._dropdown.children.length >= this._config.maxResult)
            return

        if(this._timer)
            clearTimeout(this._timer)

        let vval = this._query
        this._timer = setTimeout(() => {
            if(vval != this._query)
                return
            this._showSpinner()

            let url = this._config.filter
                .replace(/%23/g, '#')
                .replace('#QUERY#', this._query)

            if(this._relations){
                let sep = url.includes('?') ? '&' : '?'

                for(let k in this._relations){
                    let el = this._relations[k]
                    let val= $(el).val()
                    if(!val)
                        continue;

                    url+= `${sep}${k}=${val}`
                    sep = '&'
                }
            }

            $.get(url, res => {
                this._hideSpinner()
                if(this._config.preProcess)
                    res = this._config.preProcess(res)

                let local = []
                res.forEach(i => {
                    let val = i.toLowerCase()
                    if(this._items.includes(val))
                        return

                    this._items.push(val)
                    this._labels[val] = i

                    local.push(i)
                    this._result.push(i)
                })

                if(local.length)
                    this._renderItem(local)

                if(this._result.length)
                    this.show()
                else
                    this.hide()
            })
        }, this._config.filterDelay)
    }

    _findFromList(){
        this._truncateDropdown()
        this._result = []

        let local = []
        this._items.forEach(i => {
            if(!i.includes(this._query))
                return

            let label = this._labels[i]

            if(this._result.includes(label))
                return

            local.push(label)
            this._result.push(label)
        })

        // now render the result
        if(local.length){
            this._renderItem(local)
            this.show()
        }else{
            this.hide()
        }

        this._findFromAjax()
    }

    _focusNext(){
        let next = $(this._dropdown).children(':first-child').get(0)
        let focused = $(this._dropdown).children('.active').get(0)

        if(focused){
            focused.classList.remove('active')
            let tmpNext = $(focused).next().get(0)
            if(tmpNext)
                next = tmpNext
        }

        if(next)
            next.classList.add('active')
    }

    _focusPrev(){
        let next = $(this._dropdown).children(':last-child').get(0)
        let focused = $(this._dropdown).children('.active').get(0)

        if(focused){
            focused.classList.remove('active')
            let tmpNext = $(focused).prev().get(0)
            if(tmpNext)
                next = tmpNext
        }

        if(next)
            next.classList.add('active')
    }

    _getConfig(config) {
        config = {
            ...Default,
            ...config
        }
        Util.typeCheckConfig(NAME, config, DefaultType)
        return config
    }

    _handleRelations(){
        this._relations = []
        for(let name in this._config.filterRelation){
            let selector = this._config.filterRelation[name];
            this._relations[name] = $(selector).get(0)
            $(this._relations[name]).change(e => {
                this._element.value = ''
                $(this._element).change() // we need to trigger this manually
                this._items = []
            });
        }
    }

    _hideDropdown(){
        this._isShown = false
        this._dropdown.classList.remove('show')
    }

    _hideSpinner(){
        this._spinner.style.display = 'none'
    }

    _makeDropdown(){
        this._element.parentNode.style.position = 'relative'

        let tmpl = '<div class="dropdown-menu" style="width:100%"></div>'

        this._dropdown = $(tmpl).appendTo(this._element.parentNode).get(0)

    }

    _makeSpinner(){
        let tmpl = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div>'

        this._spinner = $(tmpl).appendTo(this._element.parentNode).get(0)

        $(this._spinner).css({
            position : 'absolute',
            right    : $(this._element).css('padding-right'),
            top      : (this._element.offsetTop + ((this._element.offsetHeight - this._spinner.offsetHeight)/2)) + 'px'
        })

        this._hideSpinner()
    }

    _renderItem(items){
        items.forEach(i => {
            if(this._dropdown.children.length >= this._config.maxResult)
                return

            let item = $('<a class="dropdown-item" href="#"></a>')
            let itemEl = item.get(0)

            item.text(i).appendTo(this._dropdown)

            if(this._config.onItemRendered)
                this._config.onItemRendered(this._element, itemEl)

            const renderEvent = $.Event(Event.ITEM_RENDER, {item:itemEl})

            $(this._element).trigger(renderEvent)

            item.on(Event.CLICK_DATA_API, e => {
                this._selectItem(e.target);
                this._preventClose  = true
                this.hide()
                e.preventDefault()
                this._preventClose = false
            })
        })
    }

    _selectItem(item){
        this._element.value = item.innerText

        if(this._config.onPick)
            this._config.onPick(this._element, item)

        const pickEvent = $.Event(Event.PICK, {item})
        $(this._element).trigger(pickEvent)
    }

    _showDropdown(){
        this._isShown = true
        this._dropdown.classList.add('show')
    }

    _showSpinner(){
        this._spinner.style.display = 'inline-block'
    }

    _truncateDropdown(){
        this._dropdown.innerHTML = ''
    }

    // Static

    static _jQueryInterface(config, relatedTarget) {
        return this.each(function () {
            let data = $(this).data(DATA_KEY)
            const _config = {
                ...Default,
                ...$(this).data(),
                ...typeof config === 'object' && config ? config : {}
            }

            if (!data) {
                data = new Autocomplete(this, _config)
                $(this).data(DATA_KEY, data)
            }

            if (typeof config === 'string') {
                if (typeof data[config] === 'undefined')
                    throw new TypeError(`No method named "${config}"`)
                data[config](relatedTarget)
            }
        })
    }
}

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 */

$.fn[NAME] = Autocomplete._jQueryInterface
$.fn[NAME].Constructor = Autocomplete
$.fn[NAME].noConflict = () => {
  $.fn[NAME] = JQUERY_NO_CONFLICT
  return Autocomplete._jQueryInterface
}

export default Autocomplete
