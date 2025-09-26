// Minimal ZIP (STORE) writer for browser (no compression)
// Supports adding files from ArrayBuffer and emitting a Blob

(function(global) {
	function makeCrcTable() {
		let c;
		const table = [];
		for (let n = 0; n < 256; n++) {
			c = n;
			for (let k = 0; k < 8; k++) {
				c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
			}
			table[n] = c >>> 0;
		}
		return table;
	}

	const CRC_TABLE = makeCrcTable();

	function crc32(buf) {
		let c = 0 ^ (-1);
		const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
		for (let i = 0; i < view.length; i++) {
			c = (c >>> 8) ^ CRC_TABLE[(c ^ view[i]) & 0xFF];
		}
		return (c ^ (-1)) >>> 0;
	}

	function dosDateTime(d) {
		const date = d || new Date();
		let dosTime = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1F);
		let dosDate = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0x0F) << 5) | (date.getDate() & 0x1F);
		return { dosTime, dosDate };
	}

	function encoderUtf8(str) {
		return new TextEncoder().encode(str);
	}

	function concatUint8(arrays) {
		let len = 0; arrays.forEach(a => len += a.length);
		const out = new Uint8Array(len);
		let off = 0; arrays.forEach(a => { out.set(a, off); off += a.length; });
		return out;
	}

	class ZipWriter {
		constructor() {
			this.entries = [];
			this.offset = 0;
			this.parts = [];
		}

		addFile(name, data) {
			const fileNameBytes = encoderUtf8(name);
			const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
			const crc = crc32(u8);
			const { dosTime, dosDate } = dosDateTime();
			const localHeader = new Uint8Array(30 + fileNameBytes.length);
			const view = new DataView(localHeader.buffer);
			let p = 0;
			view.setUint32(p, 0x04034b50, true); p += 4; // Local file header signature
			view.setUint16(p, 20, true); p += 2; // version needed
			view.setUint16(p, 0, true); p += 2;  // general purpose bit flag
			view.setUint16(p, 0, true); p += 2;  // compression method = STORE
			view.setUint16(p, dosTime, true); p += 2;
			view.setUint16(p, dosDate, true); p += 2;
			view.setUint32(p, crc, true); p += 4;
			view.setUint32(p, u8.length, true); p += 4; // compressed size
			view.setUint32(p, u8.length, true); p += 4; // uncompressed size
			view.setUint16(p, fileNameBytes.length, true); p += 2;
			view.setUint16(p, 0, true); p += 2; // extra field length
			localHeader.set(fileNameBytes, p);

			const localOffset = this.offset;
			this.parts.push(localHeader, u8);
			this.offset += localHeader.length + u8.length;

			this.entries.push({ nameBytes: fileNameBytes, crc, size: u8.length, offset: localOffset, dosTime, dosDate });
		}

		finalizeBlob() {
			const centralParts = [];
			let centralSize = 0;
			for (const e of this.entries) {
				const hdr = new Uint8Array(46 + e.nameBytes.length);
				const v = new DataView(hdr.buffer);
				let p = 0;
				v.setUint32(p, 0x02014b50, true); p += 4; // central file header signature
				v.setUint16(p, 20, true); p += 2; // version made by
				v.setUint16(p, 20, true); p += 2; // version needed to extract
				v.setUint16(p, 0, true); p += 2;  // general purpose bit flag
				v.setUint16(p, 0, true); p += 2;  // compression method
				v.setUint16(p, e.dosTime, true); p += 2;
				v.setUint16(p, e.dosDate, true); p += 2;
				v.setUint32(p, e.crc, true); p += 4;
				v.setUint32(p, e.size, true); p += 4; // compressed size
				v.setUint32(p, e.size, true); p += 4; // uncompressed size
				v.setUint16(p, e.nameBytes.length, true); p += 2;
				v.setUint16(p, 0, true); p += 2; // extra
				v.setUint16(p, 0, true); p += 2; // file comment length
				v.setUint16(p, 0, true); p += 2; // disk number start
				v.setUint16(p, 0, true); p += 2; // internal file attrs
				v.setUint32(p, 0, true); p += 4; // external file attrs
				v.setUint32(p, e.offset, true); p += 4; // relative offset of local header
				hdr.set(e.nameBytes, p);
				centralParts.push(hdr);
				centralSize += hdr.length;
			}

			const centralStart = this.offset;
			this.parts.push(...centralParts);
			this.offset += centralSize;

			const eocd = new Uint8Array(22);
			const dv = new DataView(eocd.buffer);
			let p2 = 0;
			dv.setUint32(p2, 0x06054b50, true); p2 += 4; // EOCD
			dv.setUint16(p2, 0, true); p2 += 2; // disk number
			dv.setUint16(p2, 0, true); p2 += 2; // start disk
			dv.setUint16(p2, this.entries.length, true); p2 += 2; // total entries on disk
			dv.setUint16(p2, this.entries.length, true); p2 += 2; // total entries
			dv.setUint32(p2, centralSize, true); p2 += 4; // size of central directory
			dv.setUint32(p2, centralStart, true); p2 += 4; // offset of central directory
			dv.setUint16(p2, 0, true); p2 += 2; // comment length
			this.parts.push(eocd);

		// Ensure each part is a Uint8Array to avoid Blob creating string parts accidentally
		const normalized = this.parts.map(p => (p instanceof Uint8Array ? p : new Uint8Array(p)));
		const blob = new Blob(normalized, { type: 'application/zip' });
			return blob;
		}
	}

	global.MiniZipWriter = ZipWriter;
})(self);


