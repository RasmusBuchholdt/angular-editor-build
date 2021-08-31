import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
export class AngularEditorService {
    constructor(http, doc) {
        this.http = http;
        this.doc = doc;
        /**
         * save selection when the editor is focussed out
         */
        this.saveSelection = () => {
            if (this.doc.getSelection) {
                const sel = this.doc.getSelection();
                if (sel.getRangeAt && sel.rangeCount) {
                    this.savedSelection = sel.getRangeAt(0);
                    this.selectedText = sel.toString();
                }
            }
            else if (this.doc.getSelection && this.doc.createRange) {
                this.savedSelection = document.createRange();
            }
            else {
                this.savedSelection = null;
            }
        };
    }
    /**
     * Executed command from editor header buttons exclude toggleEditorMode
     * @param command string from triggerCommand
     */
    executeCommand(command) {
        const commands = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'pre'];
        if (commands.includes(command)) {
            this.doc.execCommand('formatBlock', false, command);
            return;
        }
        this.doc.execCommand(command, false, null);
    }
    /**
     * Create URL link
     * @param url string from UI prompt
     */
    createLink(url) {
        if (!url.includes('http')) {
            this.doc.execCommand('createlink', false, url);
        }
        else {
            const newUrl = '<a href="' + url + '" target="_blank">' + this.selectedText + '</a>';
            this.insertHtml(newUrl);
        }
    }
    /**
     * insert color either font or background
     *
     * @param color color to be inserted
     * @param where where the color has to be inserted either text/background
     */
    insertColor(color, where) {
        const restored = this.restoreSelection();
        if (restored) {
            if (where === 'textColor') {
                this.doc.execCommand('foreColor', false, color);
            }
            else {
                this.doc.execCommand('hiliteColor', false, color);
            }
        }
    }
    /**
     * Set font name
     * @param fontName string
     */
    setFontName(fontName) {
        this.doc.execCommand('fontName', false, fontName);
    }
    /**
     * Set font size
     * @param fontSize string
     */
    setFontSize(fontSize) {
        this.doc.execCommand('fontSize', false, fontSize);
    }
    /**
     * Create raw HTML
     * @param html HTML string
     */
    insertHtml(html) {
        const isHTMLInserted = this.doc.execCommand('insertHTML', false, html);
        if (!isHTMLInserted) {
            throw new Error('Unable to perform the operation');
        }
    }
    /**
     * restore selection when the editor is focused in
     *
     * saved selection when the editor is focused out
     */
    restoreSelection() {
        if (this.savedSelection) {
            if (this.doc.getSelection) {
                const sel = this.doc.getSelection();
                sel.removeAllRanges();
                sel.addRange(this.savedSelection);
                return true;
            }
            else if (this.doc.getSelection /*&& this.savedSelection.select*/) {
                // this.savedSelection.select();
                return true;
            }
        }
        else {
            return false;
        }
    }
    /**
     * setTimeout used for execute 'saveSelection' method in next event loop iteration
     */
    executeInNextQueueIteration(callbackFn, timeout = 1e2) {
        setTimeout(callbackFn, timeout);
    }
    /** check any selection is made or not */
    checkSelection() {
        const selectedText = this.savedSelection.toString();
        if (selectedText.length === 0) {
            throw new Error('No Selection Made');
        }
        return true;
    }
    /**
     * Upload file to uploadUrl
     * @param file The file
     */
    uploadImage(file) {
        const uploadData = new FormData();
        uploadData.append('file', file, file.name);
        return this.http.post(this.uploadUrl, uploadData, {
            reportProgress: true,
            observe: 'events',
            withCredentials: this.uploadWithCredentials,
        });
    }
    /**
     * Insert image with Url
     * @param imageUrl The imageUrl.
     */
    insertImage(imageUrl) {
        this.doc.execCommand('insertImage', false, imageUrl);
    }
    setDefaultParagraphSeparator(separator) {
        this.doc.execCommand('defaultParagraphSeparator', false, separator);
    }
    createCustomClass(customClass) {
        let newTag = this.selectedText;
        if (customClass) {
            const tagName = customClass.tag ? customClass.tag : 'span';
            newTag = '<' + tagName + ' class="' + customClass.class + '">' + this.selectedText + '</' + tagName + '>';
        }
        this.insertHtml(newTag);
    }
    insertVideo(videoUrl) {
        if (videoUrl.match('www.youtube.com')) {
            this.insertYouTubeVideoTag(videoUrl);
        }
        if (videoUrl.match('vimeo.com')) {
            this.insertVimeoVideoTag(videoUrl);
        }
    }
    insertYouTubeVideoTag(videoUrl) {
        const id = videoUrl.split('v=')[1];
        const imageUrl = `https://img.youtube.com/vi/${id}/0.jpg`;
        const thumbnail = `
      <div style='position: relative'>
        <a href='${videoUrl}' target='_blank'>
          <img src="${imageUrl}" alt="click to watch"/>
          <img style='position: absolute; left:200px; top:140px'
          src="https://img.icons8.com/color/96/000000/youtube-play.png"/>
        </a>
      </div>`;
        this.insertHtml(thumbnail);
    }
    insertVimeoVideoTag(videoUrl) {
        const sub = this.http.get(`https://vimeo.com/api/oembed.json?url=${videoUrl}`).subscribe(data => {
            const imageUrl = data.thumbnail_url_with_play_button;
            const thumbnail = `<div>
        <a href='${videoUrl}' target='_blank'>
          <img src="${imageUrl}" alt="${data.title}"/>
        </a>
      </div>`;
            this.insertHtml(thumbnail);
            sub.unsubscribe();
        });
    }
    nextNode(node) {
        if (node.hasChildNodes()) {
            return node.firstChild;
        }
        else {
            while (node && !node.nextSibling) {
                node = node.parentNode;
            }
            if (!node) {
                return null;
            }
            return node.nextSibling;
        }
    }
    getRangeSelectedNodes(range, includePartiallySelectedContainers) {
        let node = range.startContainer;
        const endNode = range.endContainer;
        let rangeNodes = [];
        // Special case for a range that is contained within a single node
        if (node === endNode) {
            rangeNodes = [node];
        }
        else {
            // Iterate nodes until we hit the end container
            while (node && node !== endNode) {
                rangeNodes.push(node = this.nextNode(node));
            }
            // Add partially selected nodes at the start of the range
            node = range.startContainer;
            while (node && node !== range.commonAncestorContainer) {
                rangeNodes.unshift(node);
                node = node.parentNode;
            }
        }
        // Add ancestors of the range container, if required
        if (includePartiallySelectedContainers) {
            node = range.commonAncestorContainer;
            while (node) {
                rangeNodes.push(node);
                node = node.parentNode;
            }
        }
        return rangeNodes;
    }
    getSelectedNodes() {
        const nodes = [];
        if (this.doc.getSelection) {
            const sel = this.doc.getSelection();
            for (let i = 0, len = sel.rangeCount; i < len; ++i) {
                nodes.push.apply(nodes, this.getRangeSelectedNodes(sel.getRangeAt(i), true));
            }
        }
        return nodes;
    }
    replaceWithOwnChildren(el) {
        const parent = el.parentNode;
        while (el.hasChildNodes()) {
            parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
    }
    removeSelectedElements(tagNames) {
        const tagNamesArray = tagNames.toLowerCase().split(',');
        this.getSelectedNodes().forEach((node) => {
            if (node.nodeType === 1 &&
                tagNamesArray.indexOf(node.tagName.toLowerCase()) > -1) {
                // Remove the node and replace it with its children
                this.replaceWithOwnChildren(node);
            }
        });
    }
}
AngularEditorService.decorators = [
    { type: Injectable }
];
AngularEditorService.ctorParameters = () => [
    { type: HttpClient },
    { type: undefined, decorators: [{ type: Inject, args: [DOCUMENT,] }] }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1lZGl0b3Iuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL2FuZ3VsYXItZWRpdG9yL3NyYy9saWIvYW5ndWxhci1lZGl0b3Iuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsTUFBTSxFQUFFLFVBQVUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNqRCxPQUFPLEVBQUMsVUFBVSxFQUFZLE1BQU0sc0JBQXNCLENBQUM7QUFFM0QsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBUXpDLE1BQU0sT0FBTyxvQkFBb0I7SUFPL0IsWUFDVSxJQUFnQixFQUNFLEdBQVE7UUFEMUIsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNFLFFBQUcsR0FBSCxHQUFHLENBQUs7UUEyRXBDOztXQUVHO1FBQ0ksa0JBQWEsR0FBRyxHQUFTLEVBQUU7WUFDaEMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRTtnQkFDekIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDcEMsSUFBSSxHQUFHLENBQUMsVUFBVSxJQUFJLEdBQUcsQ0FBQyxVQUFVLEVBQUU7b0JBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDeEMsSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7aUJBQ3BDO2FBQ0Y7aUJBQU0sSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRTtnQkFDeEQsSUFBSSxDQUFDLGNBQWMsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7YUFDOUM7aUJBQU07Z0JBQ0wsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7YUFDNUI7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QUFFLENBQUMsYUFBYSxFQUFFLEVBQUU7WUFDekIsTUFBTSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ3hDO1FBQ0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRUQsc0JBQXNCLENBQUMsUUFBUTtRQUM3QixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ3ZDLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxDQUFDO2dCQUNyQixhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDeEQsbURBQW1EO2dCQUNuRCxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDbkM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7OztZQW5TRixVQUFVOzs7WUFUSCxVQUFVOzRDQW1CYixNQUFNLFNBQUMsUUFBUSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7SW5qZWN0LCBJbmplY3RhYmxlfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHtIdHRwQ2xpZW50LCBIdHRwRXZlbnR9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcclxuaW1wb3J0IHtPYnNlcnZhYmxlfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHtET0NVTUVOVH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcclxuaW1wb3J0IHtDdXN0b21DbGFzc30gZnJvbSAnLi9jb25maWcnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBVcGxvYWRSZXNwb25zZSB7XHJcbiAgaW1hZ2VVcmw6IHN0cmluZztcclxufVxyXG5cclxuQEluamVjdGFibGUoKVxyXG5leHBvcnQgY2xhc3MgQW5ndWxhckVkaXRvclNlcnZpY2Uge1xyXG5cclxuICBzYXZlZFNlbGVjdGlvbjogUmFuZ2UgfCBudWxsO1xyXG4gIHNlbGVjdGVkVGV4dDogc3RyaW5nO1xyXG4gIHVwbG9hZFVybDogc3RyaW5nO1xyXG4gIHVwbG9hZFdpdGhDcmVkZW50aWFsczogYm9vbGVhbjtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIGh0dHA6IEh0dHBDbGllbnQsXHJcbiAgICBASW5qZWN0KERPQ1VNRU5UKSBwcml2YXRlIGRvYzogYW55XHJcbiAgKSB7IH1cclxuXHJcbiAgLyoqXHJcbiAgICogRXhlY3V0ZWQgY29tbWFuZCBmcm9tIGVkaXRvciBoZWFkZXIgYnV0dG9ucyBleGNsdWRlIHRvZ2dsZUVkaXRvck1vZGVcclxuICAgKiBAcGFyYW0gY29tbWFuZCBzdHJpbmcgZnJvbSB0cmlnZ2VyQ29tbWFuZFxyXG4gICAqL1xyXG4gIGV4ZWN1dGVDb21tYW5kKGNvbW1hbmQ6IHN0cmluZykge1xyXG4gICAgY29uc3QgY29tbWFuZHMgPSBbJ2gxJywgJ2gyJywgJ2gzJywgJ2g0JywgJ2g1JywgJ2g2JywgJ3AnLCAncHJlJ107XHJcbiAgICBpZiAoY29tbWFuZHMuaW5jbHVkZXMoY29tbWFuZCkpIHtcclxuICAgICAgdGhpcy5kb2MuZXhlY0NvbW1hbmQoJ2Zvcm1hdEJsb2NrJywgZmFsc2UsIGNvbW1hbmQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmRvYy5leGVjQ29tbWFuZChjb21tYW5kLCBmYWxzZSwgbnVsbCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgVVJMIGxpbmtcclxuICAgKiBAcGFyYW0gdXJsIHN0cmluZyBmcm9tIFVJIHByb21wdFxyXG4gICAqL1xyXG4gIGNyZWF0ZUxpbmsodXJsOiBzdHJpbmcpIHtcclxuICAgIGlmICghdXJsLmluY2x1ZGVzKCdodHRwJykpIHtcclxuICAgICAgdGhpcy5kb2MuZXhlY0NvbW1hbmQoJ2NyZWF0ZWxpbmsnLCBmYWxzZSwgdXJsKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IG5ld1VybCA9ICc8YSBocmVmPVwiJyArIHVybCArICdcIiB0YXJnZXQ9XCJfYmxhbmtcIj4nICsgdGhpcy5zZWxlY3RlZFRleHQgKyAnPC9hPic7XHJcbiAgICAgIHRoaXMuaW5zZXJ0SHRtbChuZXdVcmwpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogaW5zZXJ0IGNvbG9yIGVpdGhlciBmb250IG9yIGJhY2tncm91bmRcclxuICAgKlxyXG4gICAqIEBwYXJhbSBjb2xvciBjb2xvciB0byBiZSBpbnNlcnRlZFxyXG4gICAqIEBwYXJhbSB3aGVyZSB3aGVyZSB0aGUgY29sb3IgaGFzIHRvIGJlIGluc2VydGVkIGVpdGhlciB0ZXh0L2JhY2tncm91bmRcclxuICAgKi9cclxuICBpbnNlcnRDb2xvcihjb2xvcjogc3RyaW5nLCB3aGVyZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCByZXN0b3JlZCA9IHRoaXMucmVzdG9yZVNlbGVjdGlvbigpO1xyXG4gICAgaWYgKHJlc3RvcmVkKSB7XHJcbiAgICAgIGlmICh3aGVyZSA9PT0gJ3RleHRDb2xvcicpIHtcclxuICAgICAgICB0aGlzLmRvYy5leGVjQ29tbWFuZCgnZm9yZUNvbG9yJywgZmFsc2UsIGNvbG9yKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmRvYy5leGVjQ29tbWFuZCgnaGlsaXRlQ29sb3InLCBmYWxzZSwgY29sb3IpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXQgZm9udCBuYW1lXHJcbiAgICogQHBhcmFtIGZvbnROYW1lIHN0cmluZ1xyXG4gICAqL1xyXG4gIHNldEZvbnROYW1lKGZvbnROYW1lOiBzdHJpbmcpIHtcclxuICAgIHRoaXMuZG9jLmV4ZWNDb21tYW5kKCdmb250TmFtZScsIGZhbHNlLCBmb250TmFtZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXQgZm9udCBzaXplXHJcbiAgICogQHBhcmFtIGZvbnRTaXplIHN0cmluZ1xyXG4gICAqL1xyXG4gIHNldEZvbnRTaXplKGZvbnRTaXplOiBzdHJpbmcpIHtcclxuICAgIHRoaXMuZG9jLmV4ZWNDb21tYW5kKCdmb250U2l6ZScsIGZhbHNlLCBmb250U2l6ZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgcmF3IEhUTUxcclxuICAgKiBAcGFyYW0gaHRtbCBIVE1MIHN0cmluZ1xyXG4gICAqL1xyXG4gIGluc2VydEh0bWwoaHRtbDogc3RyaW5nKTogdm9pZCB7XHJcblxyXG4gICAgY29uc3QgaXNIVE1MSW5zZXJ0ZWQgPSB0aGlzLmRvYy5leGVjQ29tbWFuZCgnaW5zZXJ0SFRNTCcsIGZhbHNlLCBodG1sKTtcclxuXHJcbiAgICBpZiAoIWlzSFRNTEluc2VydGVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHBlcmZvcm0gdGhlIG9wZXJhdGlvbicpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogc2F2ZSBzZWxlY3Rpb24gd2hlbiB0aGUgZWRpdG9yIGlzIGZvY3Vzc2VkIG91dFxyXG4gICAqL1xyXG4gIHB1YmxpYyBzYXZlU2VsZWN0aW9uID0gKCk6IHZvaWQgPT4ge1xyXG4gICAgaWYgKHRoaXMuZG9jLmdldFNlbGVjdGlvbikge1xyXG4gICAgICBjb25zdCBzZWwgPSB0aGlzLmRvYy5nZXRTZWxlY3Rpb24oKTtcclxuICAgICAgaWYgKHNlbC5nZXRSYW5nZUF0ICYmIHNlbC5yYW5nZUNvdW50KSB7XHJcbiAgICAgICAgdGhpcy5zYXZlZFNlbGVjdGlvbiA9IHNlbC5nZXRSYW5nZUF0KDApO1xyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRUZXh0ID0gc2VsLnRvU3RyaW5nKCk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAodGhpcy5kb2MuZ2V0U2VsZWN0aW9uICYmIHRoaXMuZG9jLmNyZWF0ZVJhbmdlKSB7XHJcbiAgICAgIHRoaXMuc2F2ZWRTZWxlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zYXZlZFNlbGVjdGlvbiA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiByZXN0b3JlIHNlbGVjdGlvbiB3aGVuIHRoZSBlZGl0b3IgaXMgZm9jdXNlZCBpblxyXG4gICAqXHJcbiAgICogc2F2ZWQgc2VsZWN0aW9uIHdoZW4gdGhlIGVkaXRvciBpcyBmb2N1c2VkIG91dFxyXG4gICAqL1xyXG4gIHJlc3RvcmVTZWxlY3Rpb24oKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5zYXZlZFNlbGVjdGlvbikge1xyXG4gICAgICBpZiAodGhpcy5kb2MuZ2V0U2VsZWN0aW9uKSB7XHJcbiAgICAgICAgY29uc3Qgc2VsID0gdGhpcy5kb2MuZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICAgICAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xyXG4gICAgICAgIHNlbC5hZGRSYW5nZSh0aGlzLnNhdmVkU2VsZWN0aW9uKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfSBlbHNlIGlmICh0aGlzLmRvYy5nZXRTZWxlY3Rpb24gLyomJiB0aGlzLnNhdmVkU2VsZWN0aW9uLnNlbGVjdCovKSB7XHJcbiAgICAgICAgLy8gdGhpcy5zYXZlZFNlbGVjdGlvbi5zZWxlY3QoKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogc2V0VGltZW91dCB1c2VkIGZvciBleGVjdXRlICdzYXZlU2VsZWN0aW9uJyBtZXRob2QgaW4gbmV4dCBldmVudCBsb29wIGl0ZXJhdGlvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBleGVjdXRlSW5OZXh0UXVldWVJdGVyYXRpb24oY2FsbGJhY2tGbjogKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnksIHRpbWVvdXQgPSAxZTIpOiB2b2lkIHtcclxuICAgIHNldFRpbWVvdXQoY2FsbGJhY2tGbiwgdGltZW91dCk7XHJcbiAgfVxyXG5cclxuICAvKiogY2hlY2sgYW55IHNlbGVjdGlvbiBpcyBtYWRlIG9yIG5vdCAqL1xyXG4gIHByaXZhdGUgY2hlY2tTZWxlY3Rpb24oKTogYW55IHtcclxuXHJcbiAgICBjb25zdCBzZWxlY3RlZFRleHQgPSB0aGlzLnNhdmVkU2VsZWN0aW9uLnRvU3RyaW5nKCk7XHJcblxyXG4gICAgaWYgKHNlbGVjdGVkVGV4dC5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBTZWxlY3Rpb24gTWFkZScpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGxvYWQgZmlsZSB0byB1cGxvYWRVcmxcclxuICAgKiBAcGFyYW0gZmlsZSBUaGUgZmlsZVxyXG4gICAqL1xyXG4gIHVwbG9hZEltYWdlKGZpbGU6IEZpbGUpOiBPYnNlcnZhYmxlPEh0dHBFdmVudDxVcGxvYWRSZXNwb25zZT4+IHtcclxuXHJcbiAgICBjb25zdCB1cGxvYWREYXRhOiBGb3JtRGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xyXG5cclxuICAgIHVwbG9hZERhdGEuYXBwZW5kKCdmaWxlJywgZmlsZSwgZmlsZS5uYW1lKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8VXBsb2FkUmVzcG9uc2U+KHRoaXMudXBsb2FkVXJsLCB1cGxvYWREYXRhLCB7XHJcbiAgICAgIHJlcG9ydFByb2dyZXNzOiB0cnVlLFxyXG4gICAgICBvYnNlcnZlOiAnZXZlbnRzJyxcclxuICAgICAgd2l0aENyZWRlbnRpYWxzOiB0aGlzLnVwbG9hZFdpdGhDcmVkZW50aWFscyxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5zZXJ0IGltYWdlIHdpdGggVXJsXHJcbiAgICogQHBhcmFtIGltYWdlVXJsIFRoZSBpbWFnZVVybC5cclxuICAgKi9cclxuICBpbnNlcnRJbWFnZShpbWFnZVVybDogc3RyaW5nKSB7XHJcbiAgICB0aGlzLmRvYy5leGVjQ29tbWFuZCgnaW5zZXJ0SW1hZ2UnLCBmYWxzZSwgaW1hZ2VVcmwpO1xyXG4gIH1cclxuXHJcbiAgc2V0RGVmYXVsdFBhcmFncmFwaFNlcGFyYXRvcihzZXBhcmF0b3I6IHN0cmluZykge1xyXG4gICAgdGhpcy5kb2MuZXhlY0NvbW1hbmQoJ2RlZmF1bHRQYXJhZ3JhcGhTZXBhcmF0b3InLCBmYWxzZSwgc2VwYXJhdG9yKTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZUN1c3RvbUNsYXNzKGN1c3RvbUNsYXNzOiBDdXN0b21DbGFzcykge1xyXG4gICAgbGV0IG5ld1RhZyA9IHRoaXMuc2VsZWN0ZWRUZXh0O1xyXG4gICAgaWYgKGN1c3RvbUNsYXNzKSB7XHJcbiAgICAgIGNvbnN0IHRhZ05hbWUgPSBjdXN0b21DbGFzcy50YWcgPyBjdXN0b21DbGFzcy50YWcgOiAnc3Bhbic7XHJcbiAgICAgIG5ld1RhZyA9ICc8JyArIHRhZ05hbWUgKyAnIGNsYXNzPVwiJyArIGN1c3RvbUNsYXNzLmNsYXNzICsgJ1wiPicgKyB0aGlzLnNlbGVjdGVkVGV4dCArICc8LycgKyB0YWdOYW1lICsgJz4nO1xyXG4gICAgfVxyXG4gICAgdGhpcy5pbnNlcnRIdG1sKG5ld1RhZyk7XHJcbiAgfVxyXG5cclxuICBpbnNlcnRWaWRlbyh2aWRlb1VybDogc3RyaW5nKSB7XHJcbiAgICBpZiAodmlkZW9VcmwubWF0Y2goJ3d3dy55b3V0dWJlLmNvbScpKSB7XHJcbiAgICAgIHRoaXMuaW5zZXJ0WW91VHViZVZpZGVvVGFnKHZpZGVvVXJsKTtcclxuICAgIH1cclxuICAgIGlmICh2aWRlb1VybC5tYXRjaCgndmltZW8uY29tJykpIHtcclxuICAgICAgdGhpcy5pbnNlcnRWaW1lb1ZpZGVvVGFnKHZpZGVvVXJsKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5zZXJ0WW91VHViZVZpZGVvVGFnKHZpZGVvVXJsOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGlkID0gdmlkZW9Vcmwuc3BsaXQoJ3Y9JylbMV07XHJcbiAgICBjb25zdCBpbWFnZVVybCA9IGBodHRwczovL2ltZy55b3V0dWJlLmNvbS92aS8ke2lkfS8wLmpwZ2A7XHJcbiAgICBjb25zdCB0aHVtYm5haWwgPSBgXHJcbiAgICAgIDxkaXYgc3R5bGU9J3Bvc2l0aW9uOiByZWxhdGl2ZSc+XHJcbiAgICAgICAgPGEgaHJlZj0nJHt2aWRlb1VybH0nIHRhcmdldD0nX2JsYW5rJz5cclxuICAgICAgICAgIDxpbWcgc3JjPVwiJHtpbWFnZVVybH1cIiBhbHQ9XCJjbGljayB0byB3YXRjaFwiLz5cclxuICAgICAgICAgIDxpbWcgc3R5bGU9J3Bvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDoyMDBweDsgdG9wOjE0MHB4J1xyXG4gICAgICAgICAgc3JjPVwiaHR0cHM6Ly9pbWcuaWNvbnM4LmNvbS9jb2xvci85Ni8wMDAwMDAveW91dHViZS1wbGF5LnBuZ1wiLz5cclxuICAgICAgICA8L2E+XHJcbiAgICAgIDwvZGl2PmA7XHJcbiAgICB0aGlzLmluc2VydEh0bWwodGh1bWJuYWlsKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5zZXJ0VmltZW9WaWRlb1RhZyh2aWRlb1VybDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBzdWIgPSB0aGlzLmh0dHAuZ2V0PGFueT4oYGh0dHBzOi8vdmltZW8uY29tL2FwaS9vZW1iZWQuanNvbj91cmw9JHt2aWRlb1VybH1gKS5zdWJzY3JpYmUoZGF0YSA9PiB7XHJcbiAgICAgIGNvbnN0IGltYWdlVXJsID0gZGF0YS50aHVtYm5haWxfdXJsX3dpdGhfcGxheV9idXR0b247XHJcbiAgICAgIGNvbnN0IHRodW1ibmFpbCA9IGA8ZGl2PlxyXG4gICAgICAgIDxhIGhyZWY9JyR7dmlkZW9Vcmx9JyB0YXJnZXQ9J19ibGFuayc+XHJcbiAgICAgICAgICA8aW1nIHNyYz1cIiR7aW1hZ2VVcmx9XCIgYWx0PVwiJHtkYXRhLnRpdGxlfVwiLz5cclxuICAgICAgICA8L2E+XHJcbiAgICAgIDwvZGl2PmA7XHJcbiAgICAgIHRoaXMuaW5zZXJ0SHRtbCh0aHVtYm5haWwpO1xyXG4gICAgICBzdWIudW5zdWJzY3JpYmUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbmV4dE5vZGUobm9kZSkge1xyXG4gICAgaWYgKG5vZGUuaGFzQ2hpbGROb2RlcygpKSB7XHJcbiAgICAgIHJldHVybiBub2RlLmZpcnN0Q2hpbGQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB3aGlsZSAobm9kZSAmJiAhbm9kZS5uZXh0U2libGluZykge1xyXG4gICAgICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCFub2RlKSB7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIG5vZGUubmV4dFNpYmxpbmc7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnZXRSYW5nZVNlbGVjdGVkTm9kZXMocmFuZ2UsIGluY2x1ZGVQYXJ0aWFsbHlTZWxlY3RlZENvbnRhaW5lcnMpIHtcclxuICAgIGxldCBub2RlID0gcmFuZ2Uuc3RhcnRDb250YWluZXI7XHJcbiAgICBjb25zdCBlbmROb2RlID0gcmFuZ2UuZW5kQ29udGFpbmVyO1xyXG4gICAgbGV0IHJhbmdlTm9kZXMgPSBbXTtcclxuXHJcbiAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIGEgcmFuZ2UgdGhhdCBpcyBjb250YWluZWQgd2l0aGluIGEgc2luZ2xlIG5vZGVcclxuICAgIGlmIChub2RlID09PSBlbmROb2RlKSB7XHJcbiAgICAgIHJhbmdlTm9kZXMgPSBbbm9kZV07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBJdGVyYXRlIG5vZGVzIHVudGlsIHdlIGhpdCB0aGUgZW5kIGNvbnRhaW5lclxyXG4gICAgICB3aGlsZSAobm9kZSAmJiBub2RlICE9PSBlbmROb2RlKSB7XHJcbiAgICAgICAgcmFuZ2VOb2Rlcy5wdXNoKCBub2RlID0gdGhpcy5uZXh0Tm9kZShub2RlKSApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBBZGQgcGFydGlhbGx5IHNlbGVjdGVkIG5vZGVzIGF0IHRoZSBzdGFydCBvZiB0aGUgcmFuZ2VcclxuICAgICAgbm9kZSA9IHJhbmdlLnN0YXJ0Q29udGFpbmVyO1xyXG4gICAgICB3aGlsZSAobm9kZSAmJiBub2RlICE9PSByYW5nZS5jb21tb25BbmNlc3RvckNvbnRhaW5lcikge1xyXG4gICAgICAgIHJhbmdlTm9kZXMudW5zaGlmdChub2RlKTtcclxuICAgICAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQWRkIGFuY2VzdG9ycyBvZiB0aGUgcmFuZ2UgY29udGFpbmVyLCBpZiByZXF1aXJlZFxyXG4gICAgaWYgKGluY2x1ZGVQYXJ0aWFsbHlTZWxlY3RlZENvbnRhaW5lcnMpIHtcclxuICAgICAgbm9kZSA9IHJhbmdlLmNvbW1vbkFuY2VzdG9yQ29udGFpbmVyO1xyXG4gICAgICB3aGlsZSAobm9kZSkge1xyXG4gICAgICAgIHJhbmdlTm9kZXMucHVzaChub2RlKTtcclxuICAgICAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJhbmdlTm9kZXM7XHJcbiAgfVxyXG5cclxuICBnZXRTZWxlY3RlZE5vZGVzKCkge1xyXG4gICAgY29uc3Qgbm9kZXMgPSBbXTtcclxuICAgIGlmICh0aGlzLmRvYy5nZXRTZWxlY3Rpb24pIHtcclxuICAgICAgY29uc3Qgc2VsID0gdGhpcy5kb2MuZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzZWwucmFuZ2VDb3VudDsgaSA8IGxlbjsgKytpKSB7XHJcbiAgICAgICAgbm9kZXMucHVzaC5hcHBseShub2RlcywgdGhpcy5nZXRSYW5nZVNlbGVjdGVkTm9kZXMoc2VsLmdldFJhbmdlQXQoaSksIHRydWUpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5vZGVzO1xyXG4gIH1cclxuXHJcbiAgcmVwbGFjZVdpdGhPd25DaGlsZHJlbihlbCkge1xyXG4gICAgY29uc3QgcGFyZW50ID0gZWwucGFyZW50Tm9kZTtcclxuICAgIHdoaWxlIChlbC5oYXNDaGlsZE5vZGVzKCkpIHtcclxuICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShlbC5maXJzdENoaWxkLCBlbCk7XHJcbiAgICB9XHJcbiAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoZWwpO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlU2VsZWN0ZWRFbGVtZW50cyh0YWdOYW1lcykge1xyXG4gICAgY29uc3QgdGFnTmFtZXNBcnJheSA9IHRhZ05hbWVzLnRvTG93ZXJDYXNlKCkuc3BsaXQoJywnKTtcclxuICAgIHRoaXMuZ2V0U2VsZWN0ZWROb2RlcygpLmZvckVhY2goKG5vZGUpID0+IHtcclxuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEgJiZcclxuICAgICAgICB0YWdOYW1lc0FycmF5LmluZGV4T2Yobm9kZS50YWdOYW1lLnRvTG93ZXJDYXNlKCkpID4gLTEpIHtcclxuICAgICAgICAvLyBSZW1vdmUgdGhlIG5vZGUgYW5kIHJlcGxhY2UgaXQgd2l0aCBpdHMgY2hpbGRyZW5cclxuICAgICAgICB0aGlzLnJlcGxhY2VXaXRoT3duQ2hpbGRyZW4obm9kZSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=