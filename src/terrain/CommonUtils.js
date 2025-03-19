import { ElNotification } from "element-plus";

export default class CommonUtils {
    /*
    将大驼峰字符串添加间隔符并转换为小写，也就是转换为连字符
    str:传递过来的原字符，splitStr:间隔符，默认是 '-'
    */
    static humpToHyphen(str = '', splitStr = '-') {

        if (str == '') { // 字符串是空的
            return 'str is empty';
        }
        if (typeof (str).toLowerCase() !== 'string') { //必须是字符串类型，其他的都不要
            return 'incorrect character type';
        }
        //其他条件暂时不添加限制了，比如大驼峰先转换成小驼峰再处理，只能是字符串和下划线，等等其他，自行添加

        let reg = new RegExp('[A-Z]', 'g');

        let replacedStr = str.replace(reg, function (match, offset, ss) { //match 匹配到的字符，offset 偏移量-下标，ss 原字符
            // return splitStr + match.toLowerCase()
            return splitStr + match
        })

        return replacedStr.slice(0, 1).toUpperCase() + replacedStr.slice(1)
    }

    static getApiInfoFromCategory(str) {

        if (str == '') { // 字符串是空的
            return;
        }
        if (typeof (str).toLowerCase() !== 'string') { //必须是字符串类型，其他的都不要
            return;
        }
        //其他条件暂时不添加限制了，比如大驼峰先转换成小驼峰再处理，只能是字符串和下划线，等等其他，自行添加

        let reg = new RegExp('[A-Z]', 'g');

        let replacedStr = str.replace(reg, function (match, offset, ss) { //match 匹配到的字符，offset 偏移量-下标，ss 原字符
            // return splitStr + match.toLowerCase()
            return '-' + match
        })
        let apiInfo = replacedStr.split('-');

        return apiInfo;
    }

    static staticInfoItem2GeoJsonFeature(staticInfoItem) {
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [staticInfoItem.lng, staticInfoItem.lat]
            },
            "properties": staticInfoItem
        }
    }

    static staticInfoData2GeoJson(staticInfoList) {
        let geoJsonRes = {};
        if (staticInfoList.length == 1) {
            return this.staticInfoItem2GeoJsonFeature(staticInfoList[0])
        }
        else {
            geoJsonRes = {
                "type": "FeatureCollection",
                "features": []
            }
            for (let item of staticInfoList) {
                geoJsonRes["features"].push(this.staticInfoItem2GeoJsonFeature(item));
            }
        }
        console.log(geoJsonRes);
        return geoJsonRes;
    }

    static uuid = (len, radix) => {
        //生成一段随机的uuid唯一标识符
        const chars = "0123456789abcdefghijklmnopqrstuvwxyz".split("");
        const uuid = [];
        let i;
        radix = radix || chars.length;
        if (len) {
            for (i = 0; i < len; i++) uuid[i] = chars[0 | (Math.random() * radix)];
        } else {
            let r;
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
            uuid[14] = "4";
            for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | (Math.random() * 16);
                    uuid[i] = chars[i == 19 ? (r & 0x3) | 0x8 : r];
                }
            }
        }
        return uuid.join("");
    };

    static notice(type, title, msg, offset) {
        let _offset = 180
        if (offset !== undefined) _offset = offset
        ElNotification({
            type: type,
            title: title,
            message: msg,
            offset: _offset,
        });
    }
}